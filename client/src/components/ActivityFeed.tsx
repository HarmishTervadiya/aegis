import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useWallet } from "@solana/wallet-adapter-react";

interface ExecutionRecord {
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
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ limit }) => {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { publicKey } = useWallet();

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/executions");
      let data: ExecutionRecord[] = res.data.executions || [];
      if (limit) {
        data = data.slice(0, limit);
      }
      setExecutions(data);
    } catch (err) {
      console.error("Failed to fetch executions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
    const id = setInterval(fetchExecutions, 5000);
    return () => clearInterval(id);
  }, [limit]);

  if (loading && executions.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="bg-base-200 rounded-box p-8 text-center text-base-content/60">
        <p>No recent automated activity.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Time</th>
            <th>Wallet</th>
            <th>Mode</th>
            <th>MarginFi Util</th>
            <th>Kamino Util</th>
            <th>Yield Earned</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((exec, idx) => {
            const isMine = publicKey && exec.owner === publicKey.toBase58();
            return (
              <tr key={idx} className={isMine ? "bg-primary/10" : ""}>
                <td>
                  {new Date(exec.firedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </td>
                <td>
                  {isMine ? (
                    <span className="badge badge-primary">You</span>
                  ) : (
                    <span className="font-mono text-xs opacity-70">
                      {exec.owner.slice(0, 4)}...{exec.owner.slice(-4)}
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={`badge badge-sm ${
                      exec.mode.toLowerCase() === "offense"
                        ? "badge-secondary"
                        : "badge-accent"
                    }`}
                  >
                    {exec.mode}
                  </span>
                </td>
                <td>{(exec.marginfiUtil / 100).toFixed(2)}%</td>
                <td>{(exec.kaminoUtil / 100).toFixed(2)}%</td>
                <td className="text-green font-semibold">
                  {exec.yieldEarned
                    ? `+$${(exec.yieldEarned / 1_000_000).toFixed(4)}`
                    : "-"}
                </td>
                <td>
                  <a
                    href={`https://explorer.solana.com/tx/${exec.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="link link-primary font-mono text-xs"
                  >
                    {exec.txSignature.slice(0, 8)}...
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
