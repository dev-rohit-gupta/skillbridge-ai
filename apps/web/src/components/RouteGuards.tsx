import {Navigate, Outlet, useLocation} from "react-router-dom";
import {useCurrentUser} from "../hooks/auth";
import {useAuthStore} from "../stores/auth.store";
export function ProtectedRoute() {const token = useAuthStore((s) => s.accessToken); const user = useCurrentUser(); const location = useLocation(); if (!token) return <Navigate to="/login" state={{from: location.pathname}} replace/>; if (user.isLoading) return <div className="center-screen"><div className="spinner"/></div>; if (!user.data) return <Navigate to="/login" replace/>; if (!user.data.onboardingCompleted && location.pathname !== "/onboarding") return <Navigate to="/onboarding" replace/>; return <Outlet/>}
export function PublicOnlyRoute() {return useAuthStore((s) => s.accessToken) ? <Navigate to="/app/dashboard" replace/> : <Outlet/>}
