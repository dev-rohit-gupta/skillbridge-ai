import {useMutation, useQuery} from "@tanstack/react-query";
import type {AuthResponse, LoginInput, RegisterInput, SafeUser} from "@skillbridge/shared";
import {api} from "../lib/api";
import {queryClient} from "../lib/query-client";
import {useAuthStore} from "../stores/auth.store";
export function useCurrentUser() {const enabled = useAuthStore((state) => Boolean(state.accessToken)); return useQuery({queryKey: ["auth","me"], queryFn: async () => (await api.get<{data: {user: SafeUser}}>("/auth/me")).data.data.user, enabled, retry: false})}
function useAuthMutation(endpoint: string) {const setAccessToken = useAuthStore((state) => state.setAccessToken); return useMutation({mutationFn: async (input: LoginInput|RegisterInput) => (await api.post<{data: AuthResponse}>(endpoint, input)).data.data, onSuccess: (data) => {setAccessToken(data.accessToken); queryClient.setQueryData(["auth","me"], data.user)}})}
export const useLogin = () => useAuthMutation("/auth/login"); export const useRegister = () => useAuthMutation("/auth/register");
