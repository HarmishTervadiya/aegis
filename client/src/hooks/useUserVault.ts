import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveVaultPda } from "../lib/pdas";

export function useUserVault() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchVault = async () => {
    if (!publicKey || !program) {
      setVault(null);
      return;
    }
    setLoading(true);
    try {
      const pda = deriveVaultPda(publicKey);
      const data = await (program.account as any).userVault.fetch(pda);
      setVault({ ...data, pda });
    } catch {
      setVault(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVault();
  }, [publicKey, program]);

  return { vault, loading, refreshVault: fetchVault };
}
