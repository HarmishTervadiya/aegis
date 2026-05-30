import { useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import api from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function useAuth() {
  const { publicKey, signMessage } = useWallet();
  const { authed, checking, setAuthed, setChecking } = useAuthStore();

  // On mount, ping /api/me to check if the HttpOnly cookie is still valid
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
      const { message } = await api
        .get(`/auth/nonce?wallet=${publicKey.toString()}`)
        .then((r) => r.data);

      const encoded = new TextEncoder().encode(message);
      const signature = await signMessage(encoded);
      const sigB58 = bs58.encode(signature);

      // Server sets HttpOnly cookie — no token returned in body
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
