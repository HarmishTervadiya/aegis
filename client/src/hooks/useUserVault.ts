import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveVaultPda } from "../lib/pdas";
import { useAuth } from "./useAuth";
import api from "../lib/api";

export function useUserVault() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const { authed } = useAuth();
  const [vault, setVault] = useState<any>(null);
  const [dbVault, setDbVault] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchVault = useCallback(async () => {
    if (!publicKey || !program) return;
    setLoading(true);

    // Run on-chain fetch and API fetch in parallel — don't wait for one before the other
    const [onChainResult, apiResult] = await Promise.allSettled([
      // 1. On-chain vault (authoritative for amounts)
      (async () => {
        const pda = deriveVaultPda(publicKey);
        const data = await (program.account as any).userVault.fetch(pda);
        return { ...data, pda };
      })(),
      // 2. DB vault (has depositedAt + apyAtEntry for yield ticking)
      api.get("/api/me").then((res) => res.data?.vault ?? null),
    ]);

    if (onChainResult.status === "fulfilled") {
      setVault(onChainResult.value);
    } else {
      setVault(null);
    }

    if (apiResult.status === "fulfilled") {
      setDbVault(apiResult.value);
    }
    // If API failed (e.g. 401 before cookie ready), keep previous dbVault — don't reset to null

    setLoading(false);
  }, [publicKey, program]);

  useEffect(() => {
    if (!publicKey || !program) {
      setVault(null);
      setDbVault(null);
      return;
    }
    fetchVault();
    // Re-fetch when auth state changes (cookie becomes available after login)
  }, [publicKey, program, authed]);

  return { vault, dbVault, loading, refreshVault: fetchVault };
}
