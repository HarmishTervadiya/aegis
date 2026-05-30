import { PublicKey } from "@solana/web3.js";
import { connection, program } from "../rpc.js";
import { cache } from "../cache.js";
import type { CachedTrigger } from "../cache.js";
import {
  MARGINFI_BANK,
  KAMINO_RESERVE,
  MARGINFI_ASSETS_OFFSET,
  MARGINFI_LIABILITIES_OFFSET,
  KAMINO_AVAILABLE_OFFSET,
  KAMINO_BORROWED_OFFSET,
} from "../utils/constants.js";
import { withRetry } from "../utils/retry.js";

const POLL_INTERVAL_SECONDS = parseInt(
  process.env.POLL_INTERVAL_SECONDS || "15",
);

function read128LE(buffer: Buffer, offset: number): bigint {
  const lower = buffer.readBigUInt64LE(offset);
  const upper = buffer.readBigUInt64LE(offset + 8);
  return (upper << 64n) | lower;
}

const isDevnet = process.env.VITE_NETWORK === "devnet";

/**
 * Reads MarginFi utilization.
 * MUST mirror execute_trigger.rs exactly.
 */
function readMarginFiUtilization(data: Buffer): number {
  if (isDevnet) {
    if (data.length < MARGINFI_LIABILITIES_OFFSET + 8) return 0;
    const assets = data.readBigUInt64LE(MARGINFI_ASSETS_OFFSET);
    const liabilities = data.readBigUInt64LE(MARGINFI_LIABILITIES_OFFSET);
    if (assets === 0n) return 0;
    return Number((liabilities * 10000n) / assets);
  } else {
    if (data.length < MARGINFI_LIABILITIES_OFFSET + 16) return 0;
    const assets = read128LE(data, MARGINFI_ASSETS_OFFSET);
    const liabilities = read128LE(data, MARGINFI_LIABILITIES_OFFSET);
    if (assets === 0n) return 0;
    return Number((liabilities * 10000n) / assets);
  }
}

/**
 * Reads Kamino utilization.
 * MUST mirror execute_trigger.rs exactly.
 */
function readKaminoUtilization(data: Buffer): number {
  if (isDevnet) {
    if (data.length < KAMINO_BORROWED_OFFSET + 8) return 0;
    const assets = data.readBigUInt64LE(KAMINO_AVAILABLE_OFFSET);
    const liabilities = data.readBigUInt64LE(KAMINO_BORROWED_OFFSET);
    if (assets === 0n) return 0;
    return Number((liabilities * 10000n) / assets);
  } else {
    if (data.length < KAMINO_BORROWED_OFFSET + 8) return 0;
    const available = data.readBigUInt64LE(KAMINO_AVAILABLE_OFFSET);
    const borrowed = data.readBigUInt64LE(KAMINO_BORROWED_OFFSET);
    const total = available + borrowed;
    if (total === 0n) return 0;
    return Number((borrowed * 10000n) / total);
  }
}

export async function pollProtocolState() {
  try {
    const accounts = await withRetry(() =>
      connection.getMultipleAccountsInfo(
        [MARGINFI_BANK, KAMINO_RESERVE],
        "confirmed",
      ),
    );

    const [mfi, kam] = accounts;

    if (mfi) {
      const utilBps = readMarginFiUtilization(Buffer.from(mfi.data));
      cache.marginfi.utilizationBps = utilBps;
      cache.marginfi.utilizationPct = utilBps / 100;
      cache.marginfi.updatedAt = new Date().toISOString();
    } else {
      console.warn("Watcher: MarginFi account unavailable this cycle");
    }

    if (kam) {
      const utilBps = readKaminoUtilization(Buffer.from(kam.data));
      cache.kamino.utilizationBps = utilBps;
      cache.kamino.utilizationPct = utilBps / 100;
      cache.kamino.updatedAt = new Date().toISOString();
    } else {
      console.warn("Watcher: Kamino account unavailable this cycle");
    }

    cache.lastPollAt = new Date().toISOString();
  } catch (err: any) {
    console.error("Watcher: poll error:", err.message);
  }
}

export async function fetchActiveTriggers() {
  try {
    const allTriggers = await withRetry<any[]>(() =>
      (program.account as any).triggerConfig.all(),
    );
    const newCache = new Map<string, CachedTrigger>();

    for (const t of allTriggers) {
      const acc = t.account;
      if (acc.isActive) {
        newCache.set(acc.owner.toString(), {
          triggerPda: t.publicKey,
          owner: acc.owner,
          mode: acc.mode,
          isActive: acc.isActive,
          defenseThresholdBps: acc.defenseThresholdBps,
          offenseThresholdBps: acc.offenseThresholdBps,
          executionCount: acc.executionCount,
          lastExecuted: acc.lastExecuted.toNumber(),
        });
      }
    }

    cache.activeTriggers = newCache;
  } catch (err: any) {
    console.error("Watcher: fetch triggers error:", err.message);
  }
}

function isCacheStale(
  updatedAt: string | null,
  maxAgeMs = POLL_INTERVAL_SECONDS * 2 * 1000,
) {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > maxAgeMs;
}

export function evaluateTriggers(): CachedTrigger[] {
  if (
    isCacheStale(cache.marginfi.updatedAt) ||
    isCacheStale(cache.kamino.updatedAt)
  ) {
    console.warn("Watcher: cache is stale — skipping trigger evaluation");
    return [];
  }

  const toFire: CachedTrigger[] = [];
  const mfiUtil = cache.marginfi.utilizationBps;
  const kamUtil = cache.kamino.utilizationBps;

  for (const trigger of cache.activeTriggers.values()) {
    if (!trigger.isActive) continue;

    let shouldFire = false;

    if (trigger.mode.defense) {
      // In Defense, user wants to move out of a protocol if its util is too HIGH (> defenseThreshold)
      if (
        mfiUtil > trigger.defenseThresholdBps ||
        kamUtil > trigger.defenseThresholdBps
      ) {
        shouldFire = true;
      }
    } else if (trigger.mode.offense) {
      // In Offense, user wants to move into a protocol if its util is LOW (< offenseThreshold)
      if (
        mfiUtil < trigger.offenseThresholdBps ||
        kamUtil < trigger.offenseThresholdBps
      ) {
        shouldFire = true;
      }
    }

    if (shouldFire) {
      toFire.push(trigger);
    }
  }

  return toFire;
}
