import {useMutation, useQuery} from "@tanstack/react-query";
import {ArrowRight, CheckCircle2, CircleAlert, Plus, Sparkles, Trash2} from "lucide-react";
import {useState} from "react";
import {Link, useNavigate, useParams, useSearchParams} from "react-router-dom";
import {api, errorMessage} from "../lib/api";
import {queryClient} from "../lib/query-client";

type Resume = {id: string; displayName: string; status: string; contentRevision: number; confirmedRevision: number};
type Role = {id: string; name: string; description: string; requirements: Array<{id: string; importance: string}>};
type JobSummary = {id: string; title: string; companyName?: string | null; status: string; contentRevision: number; confirmedRevision: number};

export function NewAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialJobId = searchParams.get("jobDescriptionId") ?? "";
  const [resumeId, setResumeId] = useState("");
  const [mode, setMode] = useState<"PREDEFINED_ROLE" | "CUSTOM_JOB">(initialJobId ? "CUSTOM_JOB" : "PREDEFINED_ROLE");
  const [roleId, setRoleId] = useState("");
  const [jobDescriptionId, setJobDescriptionId] = useState(initialJobId);
  const [jobForm, setJobForm] = useState({title: "", companyName: "", description: ""});

  const resumes = useQuery({
    queryKey: ["resumes"],
    queryFn: async () => (await api.get<{data: Resume[]}>("/resumes")).data.data,
  });
  const roles = useQuery({
    queryKey: ["career-roles"],
    queryFn: async () => (await api.get<{data: Role[]}>("/career-roles")).data.data,
  });
  const jobs = useQuery({
    queryKey: ["job-descriptions"],
    queryFn: async () => (await api.get<{data: JobSummary[]}>("/job-descriptions")).data.data,
  });

  const createJob = useMutation({
    mutationFn: async () => (await api.post<{data: {id: string}}>("/job-descriptions", {
      title: jobForm.title,
      companyName: jobForm.companyName || null,
      description: jobForm.description,
    })).data.data,
    onSuccess: (data) => navigate(`/app/job-descriptions/${data.id}`),
  });

  const createAnalysis = useMutation({
    mutationFn: async () => {
      const body = mode === "PREDEFINED_ROLE"
        ? {type: mode, resumeId, careerRoleId: roleId}
        : {type: mode, resumeId, jobDescriptionId};
      return (await api.post<{data: {id: string}}>("/analyses", body)).data.data;
    },
    onSuccess: (data) => navigate(`/app/analyses/${data.id}`),
  });

  const confirmedResumes = resumes.data?.filter((item) =>
    item.status === "PROCESSED" && item.contentRevision === item.confirmedRevision) ?? [];
  const confirmedJobs = jobs.data?.filter((item) =>
    item.status === "READY" && item.contentRevision === item.confirmedRevision) ?? [];
  const canRun = Boolean(resumeId && (mode === "PREDEFINED_ROLE" ? roleId : jobDescriptionId));

  return <div className="page">
    <header className="page-header">
      <div><span className="eyebrow">New comparison</span><h1>Run a skill-gap analysis</h1><p>Select a confirmed resume and compare it with a role or real job description.</p></div>
    </header>

    <section className="content-card">
      <h2>1. Choose a resume</h2>
      {confirmedResumes.length ? <div className="selection-grid">
        {confirmedResumes.map((item) => <button key={item.id} className={resumeId === item.id ? "selection-card selected" : "selection-card"} onClick={() => setResumeId(item.id)}>
          <CheckCircle2/><strong>{item.displayName}</strong>
        </button>)}
      </div> : <div className="empty"><h3>No confirmed resume</h3><p>Upload, review and confirm a resume first.</p><Link to="/app/resumes">Open resumes</Link></div>}
    </section>

    <section className="content-card">
      <h2>2. Choose the comparison target</h2>
      <div className="segmented">
        <button className={mode === "PREDEFINED_ROLE" ? "active" : ""} onClick={() => setMode("PREDEFINED_ROLE")}>Career role</button>
        <button className={mode === "CUSTOM_JOB" ? "active" : ""} onClick={() => setMode("CUSTOM_JOB")}>Job description</button>
      </div>

      {mode === "PREDEFINED_ROLE" ? <div className="role-grid">
        {roles.data?.map((role) => <button key={role.id} className={roleId === role.id ? "role-card selected" : "role-card"} onClick={() => setRoleId(role.id)}>
          <strong>{role.name}</strong><span>{role.description}</span>
          <small>{role.requirements.filter((item) => item.importance === "CORE").length} core requirements</small>
        </button>)}
      </div> : <>
        {confirmedJobs.length > 0 && <div className="selection-grid">
          {confirmedJobs.map((job) => <button key={job.id} className={jobDescriptionId === job.id ? "selection-card selected" : "selection-card"} onClick={() => setJobDescriptionId(job.id)}>
            <CheckCircle2/><strong>{job.title}</strong><span>{job.companyName ?? "Custom job"}</span>
          </button>)}
        </div>}
        <div className="sub-card">
          <h3>Add another job description</h3>
          <div className="form-grid job-form">
            <label>Job title<input value={jobForm.title} onChange={(event) => setJobForm({...jobForm, title: event.target.value})}/></label>
            <label>Company, optional<input value={jobForm.companyName} onChange={(event) => setJobForm({...jobForm, companyName: event.target.value})}/></label>
            <label className="full-field">Description<textarea rows={9} value={jobForm.description} onChange={(event) => setJobForm({...jobForm, description: event.target.value})} placeholder="Paste the complete job description…"/></label>
          </div>
          {createJob.error && <div className="error-box">{errorMessage(createJob.error)}</div>}
          <button className="secondary-button" disabled={createJob.isPending || jobForm.title.length < 2 || jobForm.description.length < 80} onClick={() => createJob.mutate()}><Plus size={17}/>{createJob.isPending ? "Extracting…" : "Extract requirements"}</button>
        </div>
      </>}
    </section>

    {createAnalysis.error && <div className="error-box">{errorMessage(createAnalysis.error)}</div>}
    <button className="primary-button wide-action" disabled={!canRun || createAnalysis.isPending} onClick={() => createAnalysis.mutate()}>
      <Sparkles size={18}/>{createAnalysis.isPending ? "Analysing…" : "Run skill analysis"}
    </button>
  </div>;
}

type JobDetail = JobSummary & {rawDescription: string; provider: string; requirements: Array<{id: string; skillId: string; skillName: string; category: string; originalText: string; importance: "CORE"|"IMPORTANT"|"OPTIONAL"; weight: number; confidenceBp: number}>};
type SkillSearch = {id: string; name: string; category: string};

export function JobDescriptionPage() {
  const {jobDescriptionId = ""} = useParams();
  const navigate = useNavigate();
  const [skillQuery, setSkillQuery] = useState("");
  const [evidence, setEvidence] = useState("");
  const detail = useQuery({
    queryKey: ["job-descriptions", jobDescriptionId],
    queryFn: async () => (await api.get<{data: JobDetail}>(`/job-descriptions/${jobDescriptionId}`)).data.data,
  });
  const search = useQuery({
    queryKey: ["skills", "search", skillQuery],
    queryFn: async () => (await api.get<{data: SkillSearch[]}>(`/skills/search?q=${encodeURIComponent(skillQuery)}`)).data.data,
    enabled: skillQuery.trim().length >= 2,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({queryKey: ["job-descriptions", jobDescriptionId]});
    await queryClient.invalidateQueries({queryKey: ["job-descriptions"]});
  };
  const update = useMutation({
    mutationFn: ({id, importance}: {id: string; importance: string}) => api.patch(`/job-descriptions/${jobDescriptionId}/requirements/${id}`, {importance, weight: importance === "CORE" ? 3 : importance === "IMPORTANT" ? 2 : 1}),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/job-descriptions/${jobDescriptionId}/requirements/${id}`),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: (skill: SkillSearch) => api.post(`/job-descriptions/${jobDescriptionId}/requirements`, {skillId: skill.id, importance: "IMPORTANT", weight: 2, originalText: evidence || `Manually added requirement: ${skill.name}`}),
    onSuccess: async () => {setSkillQuery(""); setEvidence(""); await refresh();},
  });
  const confirm = useMutation({
    mutationFn: () => api.post(`/job-descriptions/${jobDescriptionId}/confirm`),
    onSuccess: () => navigate(`/app/analyses/new?jobDescriptionId=${jobDescriptionId}`),
  });

  const job = detail.data;
  if (!job) return <div className="center-screen"><div className="spinner"/></div>;
  const confirmed = job.contentRevision === job.confirmedRevision;
  return <div className="page">
    <header className="page-header"><div><span className="eyebrow">Requirement review</span><h1>{job.title}</h1><p>{job.companyName ?? "Custom job description"} · extracted with {job.provider}</p></div>
      <button className="primary-button" disabled={confirmed || confirm.isPending} onClick={() => confirm.mutate()}><CheckCircle2 size={17}/>{confirmed ? "Confirmed" : "Confirm requirements"}</button>
    </header>
    {(confirm.error || update.error || remove.error || add.error) && <div className="error-box">{errorMessage(confirm.error ?? update.error ?? remove.error ?? add.error)}</div>}
    <section className="content-card"><h2>Detected requirements</h2><div className="requirement-list">
      {job.requirements.map((requirement) => <article className="editable-requirement" key={requirement.id}>
        <div><span className="pill">{requirement.category}</span><h3>{requirement.skillName}</h3><p>{requirement.originalText}</p></div>
        <select value={requirement.importance} onChange={(event) => update.mutate({id: requirement.id, importance: event.target.value})}><option value="CORE">Required</option><option value="IMPORTANT">Important</option><option value="OPTIONAL">Preferred</option></select>
        <button className="icon-button danger" onClick={() => remove.mutate(requirement.id)}><Trash2 size={17}/></button>
      </article>)}
    </div></section>
    <section className="content-card"><h2>Add a missing requirement</h2><div className="inline-form"><input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search a canonical skill"/><input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Evidence from the job description, optional"/></div>
      <div className="search-results">{search.data?.map((skill) => <button key={skill.id} onClick={() => add.mutate(skill)}><Plus size={15}/>{skill.name}<small>{skill.category}</small></button>)}</div>
    </section>
    <section className="content-card"><h2>Original description</h2><pre className="text-preview">{job.rawDescription}</pre></section>
  </div>;
}

type Result = {
  target: {name: string; type: string};
  resume: {displayName: string};
  overallScoreBp: number;
  matchLevel: string;
  components: {coreCoverageBp: number; baseSkillCoverageBp: number; optionalCoverageBp: number; optionalBonusBp: number; skillScoreBp: number; projectScoreBp: number; experienceScoreBp: number};
  requirements: Array<{id: string; name: string; importance: string; effectiveBp: number; matchedSkill?: {name: string}|null; evidenceSource?: string|null; acceptedSkills: Array<{name: string}>}>;
};

export function AnalysisResultPage() {
  const {analysisId = ""} = useParams();
  const navigate = useNavigate();
  const query = useQuery({queryKey: ["analyses", analysisId], queryFn: async () => (await api.get<{data: {result: Result}}>(`/analyses/${analysisId}`)).data.data.result});
  const roadmap = useMutation({mutationFn: async () => (await api.post<{data: {id: string}}>(`/analyses/${analysisId}/roadmap`)).data.data, onSuccess: (data) => navigate(`/app/roadmaps/${data.id}`)});
  const result = query.data;
  if (!result) return <div className="center-screen"><div className="spinner"/></div>;
  const matched = result.requirements.filter((item) => item.effectiveBp >= 8000);
  const partial = result.requirements.filter((item) => item.effectiveBp > 0 && item.effectiveBp < 8000);
  const missing = result.requirements.filter((item) => item.effectiveBp === 0);
  return <div className="page">
    <header className="result-hero"><div><span className="eyebrow">{result.target.name}</span><h1>{(result.overallScoreBp / 100).toFixed(1)}%</h1><strong>{result.matchLevel.replaceAll("_", " ")}</strong><p>Compared using {result.resume.displayName}</p></div><button className="primary-button" onClick={() => roadmap.mutate()} disabled={roadmap.isPending}>{roadmap.isPending ? "Generating…" : "Generate roadmap"}<ArrowRight size={17}/></button></header>
    {roadmap.error && <div className="error-box">{errorMessage(roadmap.error)}</div>}
    <section className="stat-grid compact"><Score label="Core coverage" value={result.components.coreCoverageBp}/><Score label="Skill score" value={result.components.skillScoreBp}/><Score label="Project evidence" value={result.components.projectScoreBp}/><Score label="Experience evidence" value={result.components.experienceScoreBp}/></section>
    <RequirementSection title="Matched requirements" icon={<CheckCircle2/>} items={matched} kind="matched"/>
    <RequirementSection title="Partial matches" icon={<CircleAlert/>} items={partial} kind="partial"/>
    <RequirementSection title="Missing priorities" icon={<CircleAlert/>} items={missing} kind="missing"/>
  </div>;
}

export function AnalysisHistoryPage() {
  type HistoryItem = {id: string; targetName: string; resumeName: string; overallScoreBp: number | null; matchLevel: string | null; analysisType: string; createdAt: string};
  const query = useQuery({queryKey: ["analyses"], queryFn: async () => (await api.get<{data: HistoryItem[]}>("/analyses")).data.data});
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Progress over time</span><h1>Analysis history</h1><p>Review every role and job comparison you have completed.</p></div><Link className="primary-button" to="/app/analyses/new">New analysis</Link></header>
    <section className="content-card"><div className="list">{query.data?.map((item) => <Link className="list-row" key={item.id} to={`/app/analyses/${item.id}`}><div><strong>{item.targetName}</strong><span>{item.resumeName} · {item.analysisType.replaceAll("_", " ")}</span></div><b>{item.overallScoreBp === null ? "—" : `${(item.overallScoreBp / 100).toFixed(1)}%`}</b></Link>)}</div>{query.data?.length === 0 && <div className="empty">No analyses yet.</div>}</section>
  </div>;
}

function Score({label, value}: {label: string; value: number}) {return <article className="stat-card"><span>{label}</span><strong>{(value / 100).toFixed(1)}%</strong></article>;}
function RequirementSection({title, icon, items, kind}: {title: string; icon: React.ReactNode; items: Result["requirements"]; kind: string}) {
  return <section className="content-card"><div className="section-heading"><h2>{icon}{title}</h2><span>{items.length}</span></div>{items.length ? <div className="requirement-list">{items.map((item) => <article key={item.id} className={`requirement ${kind}`}><div><strong>{item.name}</strong><span>{item.importance}</span></div><p>{item.matchedSkill ? `Matched through ${item.matchedSkill.name}${item.evidenceSource ? ` with ${item.evidenceSource.toLowerCase()} evidence` : ""}.` : `Learn one of: ${item.acceptedSkills.map((skill) => skill.name).join(", ")}.`}</p><b>{(item.effectiveBp / 100).toFixed(0)}%</b></article>)}</div> : <p className="muted">Nothing in this category.</p>}</section>;
}
