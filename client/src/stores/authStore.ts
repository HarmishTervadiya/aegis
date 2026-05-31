import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  authed: boolean;
  checking: boolean;
  token: string | null;
  setToken: (t: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authed: false,
      checking: true,
      token: null,
      setAuthed: (v) => set({ authed: v }),
      setChecking: (v) => set({ checking: v }),
      setToken: (t) => set({ token: t }),
    }),
    {
      name: "aegis-auth",
      partialize: (state) => ({ token: state.token }), // only persist the token
    }
  )
);
