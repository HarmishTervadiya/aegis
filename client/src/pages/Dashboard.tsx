import ProtocolCard from "../components/dashboard/ProtocolCard";
import { useProtocolHealth } from "../hooks/useProtocolHealth";
import { useTriggerConfig } from "../hooks/useTriggerConfig";
import { useUserVault } from "../hooks/useUserVault";
import { useUnrealizedYield } from "../hooks/useUnrealizedYield";

export default function Dashboard() {
  const { data, loading } = useProtocolHealth();
  const { trigger } = useTriggerConfig();
  const { vault, dbVault } = useUserVault();
  const unrealizedRaw = useUnrealizedYield(dbVault);

  const defenseThreshold = trigger?.defenseActive
    ? trigger.defenseThresholdBps
    : undefined;

  const currentProtocol = vault?.currentProtocol
    ? Object.keys(vault.currentProtocol)[0]
    : "Idle";

  const lifetimeYield = vault?.lifetimeYield
    ? vault.lifetimeYield.toNumber() / 1_000_000
    : 0;

  const unrealizedYield = unrealizedRaw / 1_000_000;

  // Est. APY from DB apyAtEntry (bps → %)
  const estApyPct = dbVault?.apyAtEntry
    ? (Number(dbVault.apyAtEntry) / 100).toFixed(2)
    : "0.00";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-primary">Protocol Health</h1>
        <p className="text-sm text-secondary mt-1">
          Live utilization across MarginFi and Kamino USDC pools.
          {(trigger?.defenseActive || trigger?.offenseActive) && (
            <span className="ml-2 text-green">
              Your {trigger.defenseActive ? "Defense" : ""}
              {trigger.defenseActive && trigger.offenseActive ? " and " : ""}
              {trigger.offenseActive ? "Offense" : ""} trigger is active.
            </span>
          )}
        </p>
      </div>

      {/* Yield & Status Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-secondary">Current Protocol</p>
          <p className="text-lg font-bold text-primary mt-1 capitalize">
            {currentProtocol}
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-secondary">Unrealized Yield</p>
          <p className="text-lg font-bold text-yellow-400 mt-1 font-mono tabular-nums">
            +${unrealizedYield.toFixed(6)}
          </p>
          <p className="text-[10px] text-muted mt-0.5">Live ↑</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-secondary">Lifetime Realized</p>
          <p className="text-lg font-bold text-green mt-1 font-mono">
            +${lifetimeYield.toFixed(4)}
          </p>
          <p className="text-[10px] text-muted mt-0.5">After hops</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-xs text-secondary">Est. APY at Entry</p>
          <p className="text-lg font-bold text-primary mt-1">{estApyPct}%</p>
          <p className="text-[10px] text-muted mt-0.5">When deployed</p>
        </div>
      </div>

      {/* Global Platform Yield */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-secondary flex items-center gap-1">
            Global Platform Yield
            <span
              title="Sum of all yield realized across all users and all hops"
              className="cursor-help"
            >
              ⓘ
            </span>
          </p>
          <p className="text-sm text-muted mt-0.5">
            Total interest ever harvested on Aegis
          </p>
        </div>
        <p className="text-2xl font-bold text-purple-400 font-mono">
          +$
          {(data?.projectYield ? data.projectYield / 1_000_000 : 0).toFixed(4)}
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
            thresholdBps={
              trigger?.defenseActive && currentProtocol === "marginFi"
                ? defenseThreshold
                : undefined
            }
          />
          <ProtocolCard
            name="Kamino"
            utilizationBps={data.kamino.utilizationBps}
            protocol="kamino"
            thresholdBps={
              trigger?.defenseActive && currentProtocol === "kamino"
                ? defenseThreshold
                : undefined
            }
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
