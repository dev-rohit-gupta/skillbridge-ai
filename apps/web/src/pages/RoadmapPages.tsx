import {useMutation, useQuery} from "@tanstack/react-query";
import {CheckCircle2, Circle, Clock3} from "lucide-react";
import {Link, useParams} from "react-router-dom";
import {api} from "../lib/api";
import {queryClient} from "../lib/query-client";

type RoadmapSummary = {id: string; title: string; status: string; createdAt: string};
type Roadmap = {id: string; title: string; completionPercentage: number; items: Array<{id: string; phase: number; title: string; description: string; priority: string; estimatedHours: number; status: string}>};

export function RoadmapsIndexPage() {
  const query = useQuery({queryKey: ["roadmaps"], queryFn: async () => (await api.get<{data: RoadmapSummary[]}>("/roadmaps")).data.data});
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Learning plans</span><h1>Your roadmaps</h1><p>Continue the plans generated from your skill-gap analyses.</p></div></header><section className="content-card">{query.data?.length ? <div className="list">{query.data.map((roadmap) => <Link className="list-row" key={roadmap.id} to={`/app/roadmaps/${roadmap.id}`}><div><strong>{roadmap.title}</strong><span>{roadmap.status}</span></div><b>Open</b></Link>)}</div> : <div className="empty tall"><h2>No roadmap yet</h2><p>Open an analysis result and generate a roadmap from its missing requirements.</p><Link to="/app/analyses/history">View analyses</Link></div>}</section></div>;
}

export function RoadmapPage() {
  const {roadmapId = ""} = useParams();
  const query = useQuery({queryKey: ["roadmaps", roadmapId], queryFn: async () => (await api.get<{data: Roadmap}>(`/roadmaps/${roadmapId}`)).data.data});
  const update = useMutation({mutationFn: ({itemId, status}: {itemId: string; status: string}) => api.patch(`/roadmaps/${roadmapId}/items/${itemId}/status`, {status}), onSuccess: () => queryClient.invalidateQueries({queryKey: ["roadmaps", roadmapId]})});
  if (!query.data) return <div className="center-screen"><div className="spinner"/></div>;
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Personalized plan</span><h1>{query.data.title}</h1><p>{query.data.completionPercentage}% completed</p></div><div className="progress-ring">{query.data.completionPercentage}%</div></header>{[1, 2, 3, 4].map((phase) => {const items = query.data!.items.filter((item) => item.phase === phase); if (!items.length) return null; return <section className="content-card" key={phase}><h2>Phase {phase}</h2><div className="roadmap-list">{items.map((item) => <article className={item.status === "COMPLETED" ? "roadmap-item completed" : "roadmap-item"} key={item.id}><button aria-label="Toggle completion" onClick={() => update.mutate({itemId: item.id, status: item.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED"})}>{item.status === "COMPLETED" ? <CheckCircle2/> : <Circle/>}</button><div><span className="pill">{item.priority.replaceAll("_", " ")}</span><h3>{item.title}</h3><p>{item.description}</p><small><Clock3 size={14}/>About {item.estimatedHours} hours</small></div></article>)}</div></section>;})}</div>;
}
