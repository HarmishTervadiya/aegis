import { logger } from "../utils/logger.js";
import { PublicKey } from "@solana/web3.js";
import { connection, program } from "../rpc.js";
import { cache } from "../cache.js";
import { prisma } from "../db.js";
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
      logger.warn("Watcher: MarginFi account unavailable this cycle");
    }

    if (kam) {
      const utilBps = readKaminoUtilization(Buffer.from(kam.data));
      cache.kamino.utilizationBps = utilBps;
      cache.kamino.utilizationPct = utilBps / 100;
      cache.kamino.updatedAt = new Date().toISOString();
    } else {
      logger.warn("Watcher: Kamino account unavailable this cycle");
    }

    cache.lastPollAt = new Date().toISOString();
  } catch (err: any) {
    logger.error("Watcher: poll error:", err.message);
  }
}

export async function fetchActiveTriggers() {
  try {
    const allTriggers = await withRetry<any[]>(() =>
      (program.account as any).triggerConfig.all(),
    );

    for (const t of allTriggers) {
      const acc = t.account;
      if (acc.defenseActive || acc.offenseActive) {
        await prisma.user.upsert({
          where: { walletAddress: acc.owner.toString() },
          update: {},
          create: { walletAddress: acc.owner.toString() }
        });
        
        await prisma.triggerConfig.upsert({
          where: { triggerPda: t.publicKey.toString() },
          update: {
            defenseActive: acc.defenseActive,
            offenseActive: acc.offenseActive,
            defenseThresholdBps: acc.defenseThresholdBps.toNumber(),
            offenseThresholdBps: acc.offenseThresholdBps.toNumber(),
            executionCount: acc.executionCount.toNumber(),
            lastExecuted: acc.lastExecuted.toNumber(),
          },
          create: {
            triggerPda: t.publicKey.toString(),
            userWallet: acc.owner.toString(),
            defenseActive: acc.defenseActive,
            offenseActive: acc.offenseActive,
            defenseThresholdBps: acc.defenseThresholdBps.toNumber(),
            offenseThresholdBps: acc.offenseThresholdBps.toNumber(),
            executionCount: acc.executionCount.toNumber(),
            lastExecuted: acc.lastExecuted.toNumber(),
          }
        });
      }
    }
  } catch (err: any) {
    logger.error("Watcher: fetch triggers error:", err.message);
  }
}

function isCacheStale(
  updatedAt: string | null,
  maxAgeMs = POLL_INTERVAL_SECONDS * 2 * 1000,
) {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > maxAgeMs;
}

export interface TriggerToFire {
  trigger: CachedTrigger;
  modeArgs: any; // e.g. { defense: {} } or { offense: {} }
}

export async function evaluateTriggers(): Promise<TriggerToFire[]> {
  if (
    isCacheStale(cache.marginfi.updatedAt) ||
    isCacheStale(cache.kamino.updatedAt)
  ) {
    logger.warn("Watcher: cache is stale — skipping trigger evaluation");
    return [];
  }

  const toFire: TriggerToFire[] = [];
  const mfiUtil = cache.marginfi.utilizationBps;
  const kamUtil = cache.kamino.utilizationBps;

  const activeTriggers = await prisma.triggerConfig.findMany({
    where: {
      OR: [
        { defenseActive: true },
        { offenseActive: true }
      ]
    }
  });

  for (const trigger of activeTriggers) {
    let firedMode: any = null;

    if (trigger.defenseActive) {
      if (
        mfiUtil > trigger.defenseThresholdBps ||
        kamUtil > trigger.defenseThresholdBps
      ) {
        firedMode = { defense: {} };
      }
    }

    if (!firedMode && trigger.offenseActive) {
      const diff = Math.abs(mfiUtil - kamUtil);
      if (diff > trigger.offenseThresholdBps) {
        firedMode = { offense: {} };
      }
    }

    if (firedMode) {
      toFire.push({ 
        trigger: {
          triggerPda: new PublicKey(trigger.triggerPda),
          owner: new PublicKey(trigger.userWallet),
          defenseActive: trigger.defenseActive,
          offenseActive: trigger.offenseActive,
          defenseThresholdBps: trigger.defenseThresholdBps,
          offenseThresholdBps: trigger.offenseThresholdBps,
          executionCount: trigger.executionCount,
          lastExecuted: trigger.lastExecuted,
        } as any, 
        modeArgs: firedMode 
      });
    }
  }

  return toFire;
}
