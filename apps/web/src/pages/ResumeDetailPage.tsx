import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../lib/api";
import { queryClient } from "../lib/query-client";

type Detail = {
  id: string;
  displayName: string;
  status: string;
  extractedText?: string;
  contentRevision: number;
  confirmedRevision: number;
  processingError?: string;
  skills: Array<{
    id: string;
    skillId: string;
    name: string;
    category: string;
    evidenceText: string;
    evidenceSource: string;
    confidenceBp: number;
    isRemoved: boolean;
  }>;
};
type SkillSearch = { id: string; name: string; category: string };

export function ResumeDetailPage() {
  const { resumeId = "" } = useParams();
  const navigate = useNavigate();
  const [skillQuery, setSkillQuery] = useState("");
  const [evidence, setEvidence] = useState("");
  const detail = useQuery({
    queryKey: ["resumes", resumeId],
    queryFn: async () =>
      (await api.get<{ data: Detail }>(`/resumes/${resumeId}`)).data.data,
    refetchInterval: (query) =>
      ["UPLOADED", "PROCESSING"].includes(query.state.data?.status ?? "")
        ? 2000
        : false,
  });
  const search = useQuery({
    queryKey: ["skills", "search", skillQuery],
    queryFn: async () =>
      (
        await api.get<{ data: SkillSearch[] }>(
          `/skills/search?q=${encodeURIComponent(skillQuery)}`,
        )
      ).data.data,
    enabled: skillQuery.trim().length >= 2,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["resumes"] });
    await queryClient.invalidateQueries({ queryKey: ["resumes", resumeId] });
  };
  const confirm = useMutation({
    mutationFn: () => api.post(`/resumes/${resumeId}/confirm`),
    onSuccess: async () => {
      await refresh();
      navigate("/app/analyses/new");
    },
  });
  const add = useMutation({
    mutationFn: (skill: SkillSearch) =>
      api.post(`/resumes/${resumeId}/skills`, {
        skillId: skill.id,
        evidenceText: evidence || `Manually added skill: ${skill.name}`,
      }),
    onSuccess: async () => {
      setSkillQuery("");
      setEvidence("");
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (resumeSkillId: string) =>
      api.delete(`/resumes/${resumeId}/skills/${resumeSkillId}`),
    onSuccess: refresh,
  });
  const reprocess = useMutation({
    mutationFn: () => api.post(`/resumes/${resumeId}/reprocess`),
    onSuccess: refresh,
  });

  const resume = detail.data;
  if (!resume)
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  if (resume.status === "FAILED")
    return (
      <div className="page">
        <div className="error-box">
          <h2>Resume processing failed</h2>
          <p>{resume.processingError}</p>
          <button
            className="secondary-button"
            onClick={() => reprocess.mutate()}
          >
            Retry processing
          </button>
        </div>
      </div>
    );
  if (resume.status !== "PROCESSED")
    return (
      <div className="center-screen">
        <div className="spinner" />
        <h2>Processing your resume</h2>
        <p>Extracting text and matching canonical skills…</p>
      </div>
    );
  const visibleSkills = resume.skills.filter((skill) => !skill.isRemoved);
  const error = confirm.error ?? add.error ?? remove.error ?? reprocess.error;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Review extraction</span>
          <h1>{resume.displayName}</h1>
          <p>
            Correct the detected skills, then confirm this revision before
            analysis.
          </p>
        </div>
        <button
          className="primary-button"
          disabled={
            confirm.isPending ||
            resume.contentRevision === resume.confirmedRevision
          }
          onClick={() => confirm.mutate()}
        >
          <CheckCircle2 size={17} />
          {resume.contentRevision === resume.confirmedRevision
            ? "Confirmed"
            : "Confirm resume"}
        </button>
      </header>
      {error && <div className="error-box">{errorMessage(error)}</div>}
      <section className="content-card">
        <h2>Detected skills</h2>
        <div className="skill-grid">
          {visibleSkills.map((skill) => (
            <article className="skill-card" key={skill.id}>
              <div>
                <span className="pill">{skill.category}</span>
                <span className="confidence">
                  {skill.confidenceBp >= 8000
                    ? "High"
                    : skill.confidenceBp >= 5000
                      ? "Medium"
                      : "Low"}{" "}
                  confidence
                </span>
              </div>
              <h3>{skill.name}</h3>
              <p>“{skill.evidenceText}”</p>
              <footer>
                <small>
                  Evidence: {skill.evidenceSource.replaceAll("_", " ")}
                </small>
                <button
                  className="icon-button danger"
                  aria-label={`Remove ${skill.name}`}
                  onClick={() => remove.mutate(skill.id)}
                >
                  <Trash2 size={16} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      </section>
      <section className="content-card">
        <h2>Add a missing skill</h2>
        <div className="inline-form">
          <input
            value={skillQuery}
            onChange={(event) => setSkillQuery(event.target.value)}
            placeholder="Search skills, for example Docker"
          />
          <input
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Where did you use this skill?"
          />
        </div>
        <div className="search-results">
          {search.data
            ?.filter(
              (candidate) =>
                !visibleSkills.some((skill) => skill.skillId === candidate.id),
            )
            .map((skill) => (
              <button key={skill.id} onClick={() => add.mutate(skill)}>
                <Plus size={15} />
                {skill.name}
                <small>{skill.category}</small>
              </button>
            ))}
        </div>
      </section>
      <section className="content-card">
        <h2>Extracted text preview</h2>
        <pre className="text-preview">
          {resume.extractedText?.slice(0, 6000)}
        </pre>
      </section>
    </div>
  );
}
