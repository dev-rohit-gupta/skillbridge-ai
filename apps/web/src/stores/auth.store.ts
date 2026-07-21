import {create} from "zustand";
export const useAuthStore = create<{accessToken: string|null; initialized: boolean; setAccessToken: (token: string|null) => void; setInitialized: (value: boolean) => void}>((set) => ({accessToken: null, initialized: false, setAccessToken: (accessToken) => set({accessToken}), setInitialized: (initialized) => set({initialized})}));
