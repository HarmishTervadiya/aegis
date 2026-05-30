import { useEffect } from "react";
import api from "../lib/api";
import { useHealthStore } from "../stores/healthStore";

const DEFAULT_INTERVAL_MS = 15_000;

export function useProtocolHealth(intervalMs = DEFAULT_INTERVAL_MS) {
  const { data, loading, error, setData, setLoading, setError } =
    useHealthStore();

  const fetchHealth = async () => {
    try {
      const res = await api.get("/api/health");
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to fetch health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { data, loading, error };
}
