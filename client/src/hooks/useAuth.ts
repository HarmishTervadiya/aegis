import { useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import api from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function useAuth() {
  const { publicKey, signMessage } = useWallet();
  const { authed, checking, setAuthed, setChecking, setToken } = useAuthStore();

  // On mount, ping /api/me to check if the HttpOnly cookie is still valid
  useEffect(() => {
    api
      .get("/api/me")
      .then((res) => {
        if (res.data) {
          setAuthed(true);
          if (res.data.token) {
            setToken(res.data.token);
          }
        }
      })
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
      const res = await api.post("/auth/verify", {
        wallet: publicKey.toString(),
        signature: sigB58,
      });

      if (res.data?.token) {
        setToken(res.data.token);
      }
      setAuthed(true);
    } catch (err) {
      console.error("Auth failed:", err);
    }
  }, [publicKey, signMessage]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setAuthed(false);
    setToken(null);
  }, []);

  return { authed, checking, login, logout };
}
