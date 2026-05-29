interface Props {
  utilizationPct: number;
  thresholdPct?: number; // user's defense threshold, shown as a marker
  protocol: "marginfi" | "kamino";
}

export default function UtilizationBar({
  utilizationPct,
  thresholdPct,
  protocol,
}: Props) {
  const pct = Math.min(utilizationPct, 100);
  const color = pct >= 90 ? "bg-red" : pct >= 70 ? "bg-amber" : "bg-green";
  const accent = protocol === "marginfi" ? "bg-marginfi" : "bg-kamino";

  return (
    <div className="relative w-full h-2 bg-muted rounded-full overflow-visible mt-2">
      {/* Fill */}
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
      {/* Threshold marker */}
      {thresholdPct && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary opacity-60"
          style={{ left: `${thresholdPct}%` }}
          title={`Your threshold: ${thresholdPct}%`}
        />
      )}
    </div>
  );
}
