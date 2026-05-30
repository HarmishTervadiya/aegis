import { useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveTriggerPda } from "../lib/pdas";
import { useTriggerStore } from "../stores/triggerStore";

export function useTriggerConfig() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const { trigger, loading, setTrigger, setLoading } = useTriggerStore();

  const fetchTrigger = useCallback(async () => {
    if (!publicKey || !program) return;
    setLoading(true);
    try {
      const pda = deriveTriggerPda(publicKey);
      const data = await (program.account as any).triggerConfig.fetch(pda);
      setTrigger({ ...data, pda });
    } catch {
      setTrigger(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, program]);

  useEffect(() => {
    if (!publicKey || !program) {
      setTrigger(null);
      return;
    }
    fetchTrigger();
  }, [publicKey, program]);

  return { trigger, loading, refreshTrigger: fetchTrigger };
}
