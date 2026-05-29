import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveTriggerPda } from "../lib/pdas";

export function useTriggerConfig() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const [trigger, setTrigger] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey || !program) {
      setTrigger(null);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      try {
        const pda = deriveTriggerPda(publicKey);
        const data = await (program.account as any).triggerConfig.fetch(pda);
        setTrigger({ ...data, pda });
      } catch {
        setTrigger(null); // trigger does not exist yet
      } finally {
        setLoading(false);
      }
    };

    fetch();
    // In a real app we might poll this or use websockets, but for now fetch once
  }, [publicKey, program]);

  return { trigger, loading };
}
