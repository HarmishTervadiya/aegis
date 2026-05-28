export function formatMode(mode: any): "Defense" | "Offense" | "Unknown" {
  if (mode && mode.defense !== undefined) return "Defense";
  if (mode && mode.offense !== undefined) return "Offense";
  return "Unknown";
}

export function serializeTrigger(trigger: any) {
  return {
    owner: trigger.owner.toString(),
    mode: formatMode(trigger.mode),
    defenseThresholdBps: trigger.defenseThresholdBps,
    offenseThresholdBps: trigger.offenseThresholdBps,
    executionCount: trigger.executionCount,
    lastExecuted: trigger.lastExecuted,
  };
}
