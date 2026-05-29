import { useState, useEffect } from "react";
import api from "../lib/api";

interface ProtocolState {
  utilizationBps: number;
  utilizationPct: number;
  updatedAt: string | null;
}

interface HealthData {
  marginfi: ProtocolState;
  kamino: ProtocolState;
  lastPollAt: string | null;
}

export function useProtocolHealth(intervalMs = 15_000) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get("/api/health");
        setData(res.data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { data, loading, error };
}
