import {useEffect} from "react";
import type {AxiosRequestConfig} from "axios";
import {api} from "../lib/api";
import {useAuthStore} from "../stores/auth.store";
export function AuthBootstrap({children}: {children: React.ReactNode}) {
  const initialized = useAuthStore((s) => s.initialized); const setInitialized = useAuthStore((s) => s.setInitialized); const setAccessToken = useAuthStore((s) => s.setAccessToken);
  useEffect(() => {let active = true; api.post("/auth/refresh", undefined, {_skipRefresh: true} as AxiosRequestConfig).then((response) => {if (active) setAccessToken((response.data as {data: {accessToken: string}}).data.accessToken)}).catch(() => {if (active) setAccessToken(null)}).finally(() => {if (active) setInitialized(true)}); return () => {active = false}}, [setAccessToken, setInitialized]);
  if (!initialized) return <div className="center-screen"><div className="spinner"/><p>Loading SkillBridge AI…</p></div>; return children;
}
