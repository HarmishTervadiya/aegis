import { create } from "zustand";

interface ProtocolData {
  utilizationBps: number;
  utilizationPct: number;
  apyBps: number;
  updatedAt: string | null;
}

interface HealthData {
  marginfi: ProtocolData;
  kamino: ProtocolData;
  lastPollAt: string | null;
  projectYield: number;
}

interface HealthState {
  data: HealthData | null;
  loading: boolean;
  error: string | null;
  setData: (v: HealthData | null) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}

export const useHealthStore = create<HealthState>((set) => ({
  data: null,
  loading: true,
  error: null,
  setData: (v) => set({ data: v }),
  setLoading: (v) => set({ loading: v }),
  setError: (v) => set({ error: v }),
}));
