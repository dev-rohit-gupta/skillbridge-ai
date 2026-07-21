import {Navigate, Route, Routes} from "react-router-dom";
import {AppLayout} from "./components/AppLayout";
import {ProtectedRoute, PublicOnlyRoute} from "./components/RouteGuards";
import {AnalysisHistoryPage, AnalysisResultPage, JobDescriptionPage, NewAnalysisPage} from "./pages/AnalysisPages";
import {LoginPage, RegisterPage} from "./pages/AuthPages";
import {DashboardPage} from "./pages/DashboardPage";
import {OnboardingPage} from "./pages/OnboardingPage";
import {ProfilePage} from "./pages/ProfilePage";
import {ResumeDetailPage} from "./pages/ResumeDetailPage";
import {ResumesPage} from "./pages/ResumesPage";
import {RoadmapPage, RoadmapsIndexPage} from "./pages/RoadmapPages";
export function App() {return <Routes><Route element={<PublicOnlyRoute/>}><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/></Route><Route element={<ProtectedRoute/>}><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/app" element={<AppLayout/>}><Route index element={<Navigate to="dashboard" replace/>}/><Route path="dashboard" element={<DashboardPage/>}/><Route path="resumes" element={<ResumesPage/>}/><Route path="resumes/:resumeId" element={<ResumeDetailPage/>}/><Route path="analyses/new" element={<NewAnalysisPage/>}/><Route path="analyses/history" element={<AnalysisHistoryPage/>}/><Route path="analyses/:analysisId" element={<AnalysisResultPage/>}/><Route path="job-descriptions/:jobDescriptionId" element={<JobDescriptionPage/>}/><Route path="roadmaps" element={<RoadmapsIndexPage/>}/><Route path="roadmaps/:roadmapId" element={<RoadmapPage/>}/><Route path="profile" element={<ProfilePage/>}/></Route></Route><Route path="*" element={<Navigate to="/login" replace/>}/></Routes>}
