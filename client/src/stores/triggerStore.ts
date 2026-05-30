import { create } from "zustand";

interface TriggerState {
  /** Raw on-chain trigger config account */
  trigger: any | null;
  loading: boolean;
  setTrigger: (v: any | null) => void;
  setLoading: (v: boolean) => void;
}

export const useTriggerStore = create<TriggerState>((set) => ({
  trigger: null,
  loading: false,
  setTrigger: (v) => set({ trigger: v }),
  setLoading: (v) => set({ loading: v }),
}));
