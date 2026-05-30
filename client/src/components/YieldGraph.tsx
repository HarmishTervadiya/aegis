import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "../lib/api";

interface ExecutionRecord {
  executedAt: number;
  yieldEarned: number;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  yield: number;
  cumulativeYield: number;
}

export function YieldGraph() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalYield, setTotalYield] = useState(0);

  useEffect(() => {
    const fetchYieldData = async () => {
      try {
        setLoading(true);
        // Fetch user's executions
        const res = await api.get("/api/me/executions");
        const executions: ExecutionRecord[] = res.data.executions || [];

        // Sort chronological (oldest first) for cumulative graph
        const sorted = [...executions].sort(
          (a, b) => a.executedAt - b.executedAt,
        );

        let cumulative = 0;
        const chartData = sorted.map((exec) => {
          const earned = (exec.yieldEarned || 0) / 1_000_000;
          cumulative += earned;
          return {
            time: new Date(exec.executedAt * 1000).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            timestamp: exec.executedAt * 1000,
            yield: earned,
            cumulativeYield: cumulative,
          };
        });

        // If we have no data, provide a flat 0 line for the last 24h
        if (chartData.length === 0) {
          const now = Date.now();
          const dayAgo = now - 24 * 60 * 60 * 1000;
          chartData.push({
            time: new Date(dayAgo).toLocaleDateString(),
            timestamp: dayAgo,
            yield: 0,
            cumulativeYield: 0,
          });
          chartData.push({
            time: new Date(now).toLocaleDateString(),
            timestamp: now,
            yield: 0,
            cumulativeYield: 0,
          });
        }

        setData(chartData);
        setTotalYield(cumulative);
      } catch (err) {
        console.error("Failed to fetch yield data for graph", err);
      } finally {
        setLoading(false);
      }
    };

    fetchYieldData();
  }, []);

  return (
    <div className="bg-surface border border-border rounded-xl p-5 w-full flex flex-col gap-4">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-medium text-secondary mb-1">
            Yield History
          </h2>
          <div className="text-3xl font-mono text-primary">
            +${totalYield.toFixed(4)}
          </div>
        </div>
      </div>

      <div className="h-[500px] w-full mt-2">
        {loading ? (
          <div className="w-full h-full animate-pulse bg-bg/50 rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f8fafc" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f8fafc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e1e2a"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#6b6b80"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                stroke="#6b6b80"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111118",
                  borderColor: "#1e1e2a",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#e8e8f0",
                }}
                itemStyle={{ color: "#f8fafc", fontFamily: "monospace" }}
                formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Cumulative"]}
                labelStyle={{ color: "#6b6b80", marginBottom: "4px" }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeYield"
                stroke="#f8fafc"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorYield)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
