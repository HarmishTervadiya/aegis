import { create } from "zustand";

interface AuthState {
  authed: boolean;
  checking: boolean;
  setAuthed: (v: boolean) => void;
  setChecking: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authed: false,
  checking: true,
  setAuthed: (v) => set({ authed: v }),
  setChecking: (v) => set({ checking: v }),
}));
