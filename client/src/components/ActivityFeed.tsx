import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useWallet } from "@solana/wallet-adapter-react";

interface ExecutionRecord {
  id: string;
  owner: string;
  mode: string;
  marginfiUtil: number;
  kaminoUtil: number;
  firedAt: string;
  txSignature: string;
  yieldEarned?: number;
}

interface ActivityFeedProps {
  limit?: number;
  wallet?: string;
}

/** Same interest-rate curve used in ProtocolCard — no redeployment needed */
function calcApy(utilBps: number): number {
  const pct = utilBps / 100;
  if (pct <= 80) return pct * (5 / 80);
  return 5 + (pct - 80) * (15 / 20);
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ limit, wallet }) => {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { publicKey } = useWallet();

  const fetchExecutions = async (isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (limit) params.append("limit", limit.toString());
      if (wallet) params.append("wallet", wallet);
      if (isLoadMore && nextCursor) params.append("cursor", nextCursor);

      const res = await api.get(`/api/executions?${params.toString()}`);
      
      const newExecutions: ExecutionRecord[] = res.data.executions || [];
      
      if (isLoadMore) {
        setExecutions((prev) => [...prev, ...newExecutions]);
      } else {
        setExecutions(newExecutions);
      }
      setNextCursor(res.data.nextCursor || null);
    } catch (err) {
      console.error("Failed to fetch executions", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
    // Only poll automatically if we are not paginating deep into history
    const id = setInterval(() => {
      if (!nextCursor || executions.length <= (limit || 50)) {
        // Simple polling for fresh data (resets to top)
        fetchExecutions();
      }
    }, 15000); // Polling every 15s instead of 5s to save DB load
    return () => clearInterval(id);
  }, [limit, wallet]);

  if (loading && executions.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p className="text-secondary text-sm font-medium">
          No crank executions yet
        </p>
        <p className="text-muted text-xs mt-1.5 max-w-xs leading-relaxed">
          Once your triggers fire — either because utilization crosses your
          defense threshold or a yield gap is detected — the automated crank
          logs will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header row — 8 cols now with APY */}
      <div className="hidden md:grid grid-cols-[1fr_1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr] gap-3 px-4 py-2">
        <span className="text-xs text-muted uppercase tracking-wide">Time</span>
        <span className="text-xs text-muted uppercase tracking-wide">
          Wallet
        </span>
        <span className="text-xs text-muted uppercase tracking-wide">Mode</span>
        <span className="text-xs text-muted uppercase tracking-wide">
          MFi Util
        </span>
        <span className="text-xs text-muted uppercase tracking-wide">
          Kam Util
        </span>
        <span className="text-xs text-muted uppercase tracking-wide">
          Avg APY
        </span>
        <span className="text-xs text-muted uppercase tracking-wide">
          Yield
        </span>
        <span className="text-xs text-muted uppercase tracking-wide">
          Transaction
        </span>
      </div>

      {executions.map((exec) => {
        const isMine = publicKey && exec.owner === publicKey.toBase58();
        const isOffense = exec.mode.toLowerCase() === "offense";
        // Avg APY snapshot at execution time (both protocols)
        const mfiApy = calcApy(exec.marginfiUtil);
        const kamApy = calcApy(exec.kaminoUtil);
        const avgApy = ((mfiApy + kamApy) / 2).toFixed(2);

        return (
          <div
            key={exec.id}
            className={`rounded-xl border px-4 py-3 transition-colors
              ${
                isMine
                  ? "bg-purple/5 border-purple/20"
                  : "bg-bg border-border hover:border-border/80"
              }`}
          >
            {/* Mobile layout */}
            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted font-mono">
                  {new Date(exec.firedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isOffense
                      ? "bg-purple/15 text-purple"
                      : "bg-amber/15 text-amber"
                  }`}
                >
                  {exec.mode}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-secondary">
                  {isMine ? (
                    <span className="text-purple font-semibold">You</span>
                  ) : (
                    <>
                      {exec.owner.slice(0, 4)}...{exec.owner.slice(-4)}
                    </>
                  )}
                </span>
                <span className="text-xs text-secondary font-mono">
                  <span className="text-muted">APY</span>{" "}
                  <span className="text-primary font-semibold">{avgApy}%</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-green text-xs font-mono font-semibold">
                  {exec.yieldEarned
                    ? `+$${(exec.yieldEarned / 1_000_000).toFixed(4)}`
                    : "—"}
                </span>
              </div>
              <a
                href={`https://explorer.solana.com/tx/${exec.txSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-purple hover:text-purple/80 font-mono text-xs underline underline-offset-2 transition-colors"
              >
                {exec.txSignature.slice(0, 8)}...
              </a>
            </div>

            {/* Desktop layout — 8 cols */}
            <div className="hidden md:grid grid-cols-[1fr_1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr] gap-3 items-center">
              <span className="text-xs text-secondary font-mono">
                {new Date(exec.firedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="font-mono text-xs text-secondary">
                {isMine ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple" />
                    <span className="text-purple font-semibold">You</span>
                  </span>
                ) : (
                  <>
                    {exec.owner.slice(0, 4)}...{exec.owner.slice(-4)}
                  </>
                )}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium w-fit ${
                  isOffense
                    ? "bg-purple/15 text-purple"
                    : "bg-amber/15 text-amber"
                }`}
              >
                {exec.mode}
              </span>
              <span className="text-xs text-primary font-mono">
                {(exec.marginfiUtil / 100).toFixed(1)}%
              </span>
              <span className="text-xs text-primary font-mono">
                {(exec.kaminoUtil / 100).toFixed(1)}%
              </span>
              {/* Avg APY snapshot at execution time */}
              <span className="text-xs text-green font-mono font-semibold">
                {avgApy}%
              </span>
              <span className="text-xs text-green font-mono font-semibold">
                {exec.yieldEarned
                  ? `+$${(exec.yieldEarned / 1_000_000).toFixed(4)}`
                  : "—"}
              </span>
              <a
                href={`https://explorer.solana.com/tx/${exec.txSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-purple hover:text-purple/80 font-mono text-xs underline underline-offset-2 transition-colors"
              >
                {exec.txSignature.slice(0, 8)}...
              </a>
            </div>
          </div>
        );
      })}

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => fetchExecutions(true)}
            disabled={loadingMore}
            className="px-6 py-2 rounded-lg text-sm font-medium bg-surface border border-border text-primary hover:bg-border/50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loadingMore ? (
              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : null}
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
};
