import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import api from "../lib/api";

export function useAuth() {
  const { publicKey, signMessage } = useWallet();
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  // On mount, ping /api/me to check if the cookie is still valid
  useEffect(() => {
    api
      .get("/api/me")
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, []);

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

      // Step 3: verify — server sets HttpOnly cookie, no token in response
      await api.post("/auth/verify", {
        wallet: publicKey.toString(),
        signature: sigB58,
      });

      setAuthed(true);
    } catch (err) {
      console.error("Auth failed:", err);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setAuthed(false);
  }, []);

  return { authed, checking, login, logout };
}
