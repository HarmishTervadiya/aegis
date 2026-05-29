import ProtocolCard from "../components/dashboard/ProtocolCard";
import { useProtocolHealth } from "../hooks/useProtocolHealth";
import { useTriggerConfig } from "../hooks/useTriggerConfig";

export default function Dashboard() {
  const { data, loading } = useProtocolHealth();
  const { trigger } = useTriggerConfig();

  const defenseThreshold = trigger?.defenseThresholdBps ?? undefined;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-primary">Protocol Health</h1>
        <p className="text-sm text-secondary mt-1">
          Live utilization across MarginFi and Kamino USDC pools.
          {trigger?.isActive && (
            <span className="ml-2 text-green">
              Your {trigger.mode.defense ? "Defense" : "Offense"} trigger is
              active.
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProtocolCard
            name="MarginFi"
            utilizationBps={data.marginfi.utilizationBps}
            protocol="marginfi"
            thresholdBps={trigger?.mode.defense ? defenseThreshold : undefined}
          />
          <ProtocolCard
            name="Kamino"
            utilizationBps={data.kamino.utilizationBps}
            protocol="kamino"
          />
        </div>
      ) : (
        <p className="text-secondary text-sm">Could not load protocol data.</p>
      )}

      {data && (
        <p className="text-xs text-muted mt-4 text-right">
          Updated{" "}
          {data.lastPollAt
            ? new Date(data.lastPollAt).toLocaleTimeString()
            : "—"}
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 animate-pulse h-40" />
  );
}
