import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../stores/auth.store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api/v1",
  withCredentials: true,
  timeout: 30000,
});


api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
declare module "axios" {
  interface AxiosRequestConfig {
    _retry?: boolean;
    _skipRefresh?: boolean;
  }
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
    _skipRefresh?: boolean;
  }
}
let refreshPromise: Promise<string> | null = null;


async function refreshAccessToken() {
  refreshPromise ??= api
    .post("/auth/refresh", undefined, {
      _skipRefresh: true,
    } as AxiosRequestConfig)
    .then((response) => {
      const token = (response.data as { data: { accessToken: string } }).data
        .accessToken;
      useAuthStore.getState().setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}


api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as InternalAxiosRequestConfig | undefined;
  if (
    error.response?.status === 401 &&
    config &&
    !config._retry &&
    !config._skipRefresh &&
    !config.url?.includes("/auth/")
  ) {
    config._retry = true;
    try {
      config.headers.Authorization = `Bearer ${await refreshAccessToken()}`;
      return api(config);
    } catch {
      useAuthStore.getState().setAccessToken(null);
    }
  }
  return Promise.reject(error);
});


export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error))
    return (
      (error.response?.data as { error?: { message?: string } } | undefined)
        ?.error?.message ?? error.message
    );
  return error instanceof Error ? error.message : "Something went wrong.";
}
