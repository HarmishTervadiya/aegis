import { useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveVaultPda } from "../lib/pdas";
import { useAuthStore } from "../stores/authStore";
import { useVaultStore } from "../stores/vaultStore";
import api from "../lib/api";

export function useUserVault() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const { authed } = useAuthStore();
  const { vault, dbVault, loading, setVault, setDbVault, setLoading } =
    useVaultStore();

  const fetchVault = useCallback(async () => {
    if (!publicKey || !program) return;
    setLoading(true);

    // Fetch on-chain state and DB state in parallel — no sequential blocking
    const [onChainResult, apiResult] = await Promise.allSettled([
      (async () => {
        const pda = deriveVaultPda(publicKey);
        const data = await (program.account as any).userVault.fetch(pda);
        return { ...data, pda };
      })(),
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
    // On 401 (cookie not ready), keep previous dbVault — don't flash null

    setLoading(false);
  }, [publicKey, program]);

  useEffect(() => {
    if (!publicKey || !program) {
      setVault(null);
      setDbVault(null);
      return;
    }
    fetchVault();

    // Poll every 10 seconds to catch autonomous crank executions from the backend
    const interval = setInterval(fetchVault, 10000);

    return () => clearInterval(interval);
  }, [publicKey, program, authed, fetchVault]);

  return { vault, dbVault, loading, refreshVault: fetchVault };
}
