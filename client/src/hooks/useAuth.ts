import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import api from "../lib/api";

export function useAuth() {
  const { publicKey, signMessage } = useWallet();
  const [authed, setAuthed] = useState(!!localStorage.getItem("aegis_token"));

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) return;

    try {
      // Step 1: get nonce
      const { message } = await api
        .get(`/auth/nonce?wallet=${publicKey.toString()}`)
        .then((r) => r.data);

      // Step 2: sign with wallet — no SOL spent, just a signature
      const encoded = new TextEncoder().encode(message);
      const signature = await signMessage(encoded);
      const sigB58 = bs58.encode(signature);

      // Step 3: verify + receive JWT
      const { token } = await api
        .post("/auth/verify", {
          wallet: publicKey.toString(),
          signature: sigB58,
        })
        .then((r) => r.data);

      localStorage.setItem("aegis_token", token);
      setAuthed(true);
    } catch (err) {
      console.error("Auth failed:", err);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(() => {
    localStorage.removeItem("aegis_token");
    setAuthed(false);
  }, []);

  return { authed, login, logout };
}
