import UtilizationBar from "./UtilizationBar";
import { formatBps } from "../../lib/format";

interface Props {
  name: "MarginFi" | "Kamino";
  utilizationBps: number;
  protocol: "marginfi" | "kamino";
  thresholdBps?: number;
}

export default function ProtocolCard({
  name,
  utilizationBps,
  protocol,
  thresholdBps,
}: Props) {
  const pct = utilizationBps / 100;

  // Mock DeFi Interest Rate Curve
  const calculateMockApy = (utilPct: number) => {
    if (utilPct <= 80) {
      return utilPct * (5 / 80); // Scales 0% to 5% APY
    } else {
      return 5 + (utilPct - 80) * ((20 - 5) / (100 - 80)); // Spikes from 5% to 20% APY
    }
  };
  const apy = calculateMockApy(pct);

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-secondary">{name}</span>
        </div>
        <span className="text-xs text-muted">USDC Pool</span>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-3xl font-mono font-medium text-primary">
            {pct.toFixed(2)}
            <span className="text-lg text-secondary">%</span>
          </p>
          <p className="text-xs text-muted mt-1">Utilization</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-mono font-medium text-green">
            {apy.toFixed(2)}
            <span className="text-sm text-secondary">%</span>
          </p>
          <p className="text-xs text-muted mt-1">Estimated APY</p>
        </div>
      </div>

      <UtilizationBar
        utilizationPct={pct}
        thresholdPct={thresholdBps ? thresholdBps / 100 : undefined}
        protocol={protocol}
      />

      <div className="flex justify-between text-xs text-muted">
        <span>0%</span>
        <span className="text-secondary">
          {formatBps(utilizationBps)} utilization
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}
