import { create } from "zustand";

interface VaultState {
  /** Raw on-chain vault (authoritative for balances) */
  vault: any | null;
  /** DB-backed vault record (has depositedAt + apyAtEntry) */
  dbVault: any | null;
  loading: boolean;
  setVault: (v: any | null) => void;
  setDbVault: (v: any | null) => void;
  setLoading: (v: boolean) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  vault: null,
  dbVault: null,
  loading: false,
  setVault: (v) => set({ vault: v }),
  setDbVault: (v) => set({ dbVault: v }),
  setLoading: (v) => set({ loading: v }),
}));
