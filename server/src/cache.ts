export interface ProtocolHealth {
  utilizationBps: number;
  utilizationPct: number;
  apyBps: number;
  updatedAt: string | null;
}

export interface CachedTrigger {
  triggerPda: any; // PublicKey
  owner: any; // PublicKey
  mode: any;
  isActive: boolean;
  defenseThresholdBps: number;
  offenseThresholdBps: number;
  executionCount: number;
  lastExecuted: number;
}

export interface ExecutionRecord {
  owner: string;
  mode: string;
  marginfiUtil: number;
  kaminoUtil: number;
  firedAt: string;
  txSignature: string;
}

export interface CacheStore {
  marginfi: ProtocolHealth;
  kamino: ProtocolHealth;
  activeTriggers: Map<string, CachedTrigger>;
  recentExecutions: ExecutionRecord[];
  lastPollAt: string | null;
}

export const cache: CacheStore = {
  // Protocol health data
  marginfi: {
    utilizationBps: 0,
    utilizationPct: 0,
    apyBps: 0,
    updatedAt: null,
  },
  kamino: {
    utilizationBps: 0,
    utilizationPct: 0,
    apyBps: 0,
    updatedAt: null,
  },

  // All active triggers fetched from chain
  // Map of owner pubkey string -> TriggerConfig account data
  activeTriggers: new Map(),

  // Recent executions fired by the crank this session
  recentExecutions: [],

  // Track last poll time
  lastPollAt: null,
};
