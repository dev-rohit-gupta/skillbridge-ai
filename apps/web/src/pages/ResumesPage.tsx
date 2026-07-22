import { useMutation, useQuery } from "@tanstack/react-query";
import { FileUp, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { uploadResumeToSignedUrl } from "../lib/supabase";

type Resume = {
  id: string;
  displayName: string;
  originalFilename: string;
  status: string;
  isActive: boolean;
  contentRevision: number;
  confirmedRevision: number;
  processingError?: string;
};

type UploadIntent = {
  resumeId: string;
  signedUrl: string;
};

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function resolveMimeType(file: File) {
  if (file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf")) {
    return PDF_MIME;
  }
  if (file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx")) {
    return DOCX_MIME;
  }
  throw new Error("Only PDF and DOCX resumes are accepted.");
}

export function ResumesPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");

  const resumes = useQuery({
    queryKey: ["resumes"],
    queryFn: async () => (await api.get<{ data: Resume[] }>("/resumes")).data.data,
    refetchInterval: (query) =>
      query.state.data?.some((item) => ["UPLOADED", "PROCESSING"].includes(item.status))
        ? 2_000
        : false,
  });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Select a resume file.");
      if (file.size <= 0) throw new Error("The selected file is empty.");
      if (file.size > MAX_RESUME_BYTES) throw new Error("Resume files may be at most 5 MB.");

      const mimeType = resolveMimeType(file);
      const intentResponse = await api.post<{ data: UploadIntent }>("/resumes/upload-intent", {
        displayName: displayName.trim() || undefined,
        originalFilename: file.name,
        mimeType,
        fileSizeBytes: file.size,
      });
      const intent = intentResponse.data.data;

      try {
        await uploadResumeToSignedUrl(intent.signedUrl, file);
      } catch (error) {
        await api.delete(`/resumes/${intent.resumeId}`).catch(() => undefined);
        throw error;
      }

      await api.post(`/resumes/${intent.resumeId}/complete-upload`);
      return intent;
    },
    onSuccess: () => {
      setDisplayName("");
      if (fileRef.current) fileRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["resumes"] });
    },
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Resume workspace</span>
          <h1>Your resumes</h1>
          <p>Upload a readable PDF or DOCX file up to 5 MB.</p>
        </div>
      </header>

      <section className="upload-card">
        <FileUp size={28} />
        <div>
          <h2>Upload a resume</h2>
          <p>
            The file uploads directly to private storage, then the API extracts text,
            detects skills and shows the evidence before analysis.
          </p>
        </div>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name (optional)"
        />
        <input ref={fileRef} type="file" accept=".pdf,.docx" />
        <button
          className="primary-button"
          onClick={() => upload.mutate()}
          disabled={upload.isPending}
        >
          {upload.isPending ? "Uploading and processing…" : "Upload"}
        </button>
        {upload.error && <div className="error-box">{errorMessage(upload.error)}</div>}
      </section>

      <section className="content-card">
        <div className="section-heading">
          <h2>Uploaded resumes</h2>
          {resumes.isFetching && <RefreshCw className="spin" size={18} />}
        </div>
        <div className="resume-grid">
          {resumes.data?.map((resume) => (
            <Link to={`/app/resumes/${resume.id}`} className="resume-card" key={resume.id}>
              <div>
                <span className={`status ${resume.status.toLowerCase()}`}>{resume.status}</span>
                {resume.isActive && <span className="status active-status">ACTIVE</span>}
              </div>
              <h3>{resume.displayName}</h3>
              <p>{resume.originalFilename}</p>
              <small>
                {resume.contentRevision > 0 &&
                resume.contentRevision === resume.confirmedRevision
                  ? "Confirmed for analysis"
                  : resume.status === "PROCESSED"
                    ? "Needs review"
                    : resume.processingError ?? "Processing"}
              </small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
