import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveTriggerPda } from "../lib/pdas";

export function useTriggerConfig() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const [trigger, setTrigger] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchTrigger = async () => {
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
  };

  useEffect(() => {
    if (!publicKey || !program) {
      setTrigger(null);
      return;
    }
    fetchTrigger();
  }, [publicKey, program]);

  return { trigger, loading, refreshTrigger: fetchTrigger };
}
