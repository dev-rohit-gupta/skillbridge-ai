import {BarChart3, FileText, History, Home, LogOut, Map, UserRound} from "lucide-react";
import {NavLink, Outlet, useNavigate} from "react-router-dom";
import {api} from "../lib/api";
import {queryClient} from "../lib/query-client";
import {useAuthStore} from "../stores/auth.store";
const links = [["/app/dashboard","Dashboard",Home],["/app/resumes","Resumes",FileText],["/app/analyses/new","New Analysis",BarChart3],["/app/analyses/history","History",History],["/app/roadmaps","Roadmap",Map],["/app/profile","Profile",UserRound]] as const;
export function AppLayout() {const navigate = useNavigate(); async function logout() {try {await api.post("/auth/logout")} finally {useAuthStore.getState().setAccessToken(null); queryClient.clear(); navigate("/login", {replace: true})}} return <div className="app-shell"><aside className="sidebar"><NavLink to="/app/dashboard" className="brand"><span>SB</span><strong>SkillBridge AI</strong></NavLink><nav>{links.map(([to,label,Icon]) => <NavLink key={to} to={to} className={({isActive}) => isActive ? "nav-link active" : "nav-link"}><Icon size={18}/>{label}</NavLink>)}</nav><button className="nav-link logout" onClick={logout}><LogOut size={18}/>Logout</button></aside><main className="main-content"><Outlet/></main></div>}
