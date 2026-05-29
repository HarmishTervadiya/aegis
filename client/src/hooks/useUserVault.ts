import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAegisProgram } from "./useAegisProgram";
import { deriveVaultPda } from "../lib/pdas";

export function useUserVault() {
  const { publicKey } = useWallet();
  const program = useAegisProgram();
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey || !program) {
      setVault(null);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      try {
        const pda = deriveVaultPda(publicKey);
        const data = await program.account.userVault.fetch(pda);
        setVault({ ...data, pda });
      } catch {
        setVault(null); // vault does not exist yet
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [publicKey, program]);

  return { vault, loading };
}
