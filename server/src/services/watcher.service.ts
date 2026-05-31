import { logger } from "../utils/logger.js";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { connection, program } from "../rpc.js";
import { cache } from "../cache.js";
import { prisma } from "../db.js";
import type { CachedTrigger } from "../cache.js";
import { fireExecuteTrigger } from "./executor.service.js";
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

/**
 * Mirrors the ProtocolCard APY curve in the frontend.
 * 0–80% util → 0–5% APY (0–500 bps)
 * 80–100% util → 5–20% APY (500–2000 bps)
 */
export function calculateApyFromUtil(utilizationBps: number): number {
  if (utilizationBps <= 8000) {
    return (utilizationBps * 500) / 8000;
  } else {
    return 500 + ((utilizationBps - 8000) * 1500) / 2000;
  }
}

function read128LE(buffer: Buffer, offset: number): bigint {
  const lower = buffer.readBigUInt64LE(offset);
  const upper = buffer.readBigUInt64LE(offset + 8);
  return (upper << 64n) | lower;
}

const isDevnet = process.env.RPC_URL?.includes("devnet") || process.env.VITE_NETWORK === "devnet";

/**
 * Reads MarginFi utilization.
 * MUST mirror execute_trigger.rs exactly.
 * Note: Devnet uses a Mock Lending Program with different struct offsets than Mainnet.
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
 * Note: Devnet uses a Mock Lending Program with different struct offsets than Mainnet.
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

async function handleProtocolUpdate() {
  try {
    const toFire = await evaluateTriggers();
    for (const trigger of toFire) {
      // fireExecuteTrigger uses inFlight set to prevent duplicates
      fireExecuteTrigger(trigger).catch((e) => logger.error("Executor fail:", e));
    }
  } catch (e) {
    logger.error("Watcher: trigger evaluation failed (likely DB timeout):", e);
  }
}

export async function initProtocolIndexer() {
  logger.info("Watcher: Initializing WebSocket Indexer for Protocols...");

  // 1. One-time poll to populate cache
  await pollProtocolState();

  // 2. Subscribe to MarginFi Bank changes via WebSocket (best effort)
  connection.onAccountChange(
    MARGINFI_BANK,
    async (accountInfo) => {
      const utilBps = readMarginFiUtilization(Buffer.from(accountInfo.data));
      cache.marginfi.utilizationBps = utilBps;
      cache.marginfi.utilizationPct = utilBps / 100;
      cache.marginfi.updatedAt = new Date().toISOString();
      cache.lastPollAt = new Date().toISOString();
      logger.info(`[WS] MarginFi updated: ${(utilBps / 100).toFixed(2)}%`);
      await handleProtocolUpdate();
    },
    "confirmed",
  );

  // 3. Subscribe to Kamino Reserve changes via WebSocket (best effort)
  connection.onAccountChange(
    KAMINO_RESERVE,
    async (accountInfo) => {
      const utilBps = readKaminoUtilization(Buffer.from(accountInfo.data));
      cache.kamino.utilizationBps = utilBps;
      cache.kamino.utilizationPct = utilBps / 100;
      cache.kamino.updatedAt = new Date().toISOString();
      cache.lastPollAt = new Date().toISOString();
      logger.info(`[WS] Kamino updated: ${(utilBps / 100).toFixed(2)}%`);
      await handleProtocolUpdate();
    },
    "confirmed",
  );

  // 4. Fallback polling loop — keeps cache fresh even if WebSocket drops
  logger.info(`[Watcher] Starting fallback HTTP poll every ${POLL_INTERVAL_SECONDS}s`);
  setInterval(async () => {
    await pollProtocolState();
    logger.info(
      `[Poll] MarginFi: ${cache.marginfi.utilizationPct.toFixed(2)}% | Kamino: ${cache.kamino.utilizationPct.toFixed(2)}%`,
    );
    await handleProtocolUpdate();
  }, POLL_INTERVAL_SECONDS * 1000);
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
          create: { walletAddress: acc.owner.toString() },
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
          },
        });
      } else {
        // If the polling loop catches an inactive trigger, delete it from DB
        await prisma.triggerConfig
          .delete({
            where: { triggerPda: t.publicKey.toString() },
          })
          .catch(() => {});
      }
    }
  } catch (err: any) {
    logger.error("Watcher: fetch triggers error:", err.message);
  }
}

export async function initTriggerIndexer() {
  logger.info("Watcher: Initializing WebSocket Indexer for TriggerConfig...");

  // 1. One-time poll to catch up on any missed updates while offline
  await fetchActiveTriggers();

  // 2. Subscribe to all future changes instantly
  const discriminator = bs58.encode(
    Buffer.from([234, 212, 204, 15, 217, 116, 90, 35]),
  );

  connection.onProgramAccountChange(
    program.programId,
    async (keyedAccountInfo) => {
      const pda = keyedAccountInfo.accountId.toString();

      try {
        const acc = program.coder.accounts.decode(
          "triggerConfig",
          keyedAccountInfo.accountInfo.data,
        );

        if (acc.defenseActive || acc.offenseActive) {
          logger.info(`Watcher: Trigger updated on-chain for PDA ${pda}`);

          await prisma.user.upsert({
            where: { walletAddress: acc.owner.toString() },
            update: {},
            create: { walletAddress: acc.owner.toString() },
          });

          await prisma.triggerConfig.upsert({
            where: { triggerPda: pda },
            update: {
              defenseActive: acc.defenseActive,
              offenseActive: acc.offenseActive,
              defenseThresholdBps: acc.defenseThresholdBps.toNumber(),
              offenseThresholdBps: acc.offenseThresholdBps.toNumber(),
              executionCount: acc.executionCount.toNumber(),
              lastExecuted: acc.lastExecuted.toNumber(),
            },
            create: {
              triggerPda: pda,
              userWallet: acc.owner.toString(),
              defenseActive: acc.defenseActive,
              offenseActive: acc.offenseActive,
              defenseThresholdBps: acc.defenseThresholdBps.toNumber(),
              offenseThresholdBps: acc.offenseThresholdBps.toNumber(),
              executionCount: acc.executionCount.toNumber(),
              lastExecuted: acc.lastExecuted.toNumber(),
            },
          });
        } else {
          // Trigger explicitly deactivated by user
          logger.info(
            `Watcher: Trigger deactivated on-chain. Removing from DB... [PDA: ${pda}]`,
          );
          await prisma.triggerConfig
            .delete({ where: { triggerPda: pda } })
            .catch(() => {});
        }
      } catch (err) {
        // Failed to decode. This happens if the account was closed/deleted (lamports=0, data length=0)
        logger.info(
          `Watcher: Trigger deleted/closed on-chain. Removing from DB... [PDA: ${pda}]`,
        );
        await prisma.triggerConfig
          .delete({ where: { triggerPda: pda } })
          .catch(() => {});
      }
    },
    "confirmed",
    [
      {
        memcmp: {
          offset: 0,
          bytes: discriminator,
        },
      },
    ],
  );
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
      OR: [{ defenseActive: true }, { offenseActive: true }],
    },
    include: {
      user: {
        include: { vault: true },
      },
    },
  });

  for (const trigger of activeTriggers) {
    let firedMode: any = null;
    const currentProtocol = trigger.user.vault?.currentProtocol || "Idle";

    if (trigger.defenseActive) {
      let conditionMet = false;
      if (
        currentProtocol === "marginFi" &&
        mfiUtil > trigger.defenseThresholdBps
      ) {
        conditionMet = true;
      } else if (
        currentProtocol === "kamino" &&
        kamUtil > trigger.defenseThresholdBps
      ) {
        conditionMet = true;
      }
      if (conditionMet) {
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
        modeArgs: firedMode,
      });
    }
  }

  return toFire;
}

export async function initVaultIndexer() {
  logger.info("Watcher: Initializing WebSocket Indexer for UserVault...");
  const discriminator = bs58.encode(
    Buffer.from([211, 8, 232, 43, 2, 152, 117, 119]),
  ); // Vault discriminator

  connection.onProgramAccountChange(
    program.programId,
    async (keyedAccountInfo) => {
      const pda = keyedAccountInfo.accountId.toString();
      try {
        const acc = program.coder.accounts.decode(
          "userVault",
          keyedAccountInfo.accountInfo.data,
        );
        const currentProtocol = Object.keys(acc.currentProtocol)[0] as string;

        await prisma.user.upsert({
          where: { walletAddress: acc.owner.toString() },
          update: {},
          create: { walletAddress: acc.owner.toString() },
        });

        // Determine the APY at entry based on the current active protocol
        const apyUtilBps =
          currentProtocol === "marginFi"
            ? cache.marginfi.utilizationBps
            : currentProtocol === "kamino"
              ? cache.kamino.utilizationBps
              : 0;
        const apyAtEntry = calculateApyFromUtil(apyUtilBps);

        // Check if protocol has changed — if so reset depositedAt
        const existing = await prisma.userVault.findUnique({
          where: { vaultPda: pda },
        });
        const protocolChanged =
          existing && existing.currentProtocol !== currentProtocol;

        await prisma.userVault.upsert({
          where: { vaultPda: pda },
          update: {
            currentProtocol,
            usdcDeposited: BigInt(acc.usdcDeposited.toString()),
            lifetimeYield: BigInt(acc.lifetimeYield.toString()),
            ...(protocolChanged || !existing
              ? { depositedAt: new Date(), apyAtEntry }
              : {}),
          },
          create: {
            vaultPda: pda,
            userWallet: acc.owner.toString(),
            currentProtocol,
            usdcDeposited: BigInt(acc.usdcDeposited.toString()),
            lifetimeYield: BigInt(acc.lifetimeYield.toString()),
            depositedAt: new Date(),
            apyAtEntry,
          },
        });
      } catch (err) {}
    },
    "confirmed",
    [{ memcmp: { offset: 0, bytes: discriminator } }],
  );

  // Sync existing vaults on startup
  try {
    const discriminator = bs58.encode(
      Buffer.from([211, 8, 232, 43, 2, 152, 117, 119]),
    );
    const accounts = await connection.getProgramAccounts(program.programId, {
      filters: [{ memcmp: { offset: 0, bytes: discriminator } }],
    });

    for (const v of accounts) {
      try {
        const acc = program.coder.accounts.decode("userVault", v.account.data);
        const currentProtocol = Object.keys(acc.currentProtocol)[0] as string;
        const apyUtilBps =
          currentProtocol === "marginFi"
            ? cache.marginfi.utilizationBps
            : currentProtocol === "kamino"
              ? cache.kamino.utilizationBps
              : 0;
        const apyAtEntry = calculateApyFromUtil(apyUtilBps);

        await prisma.user.upsert({
          where: { walletAddress: acc.owner.toString() },
          update: {},
          create: { walletAddress: acc.owner.toString() },
        });
        await prisma.userVault.upsert({
          where: { vaultPda: v.pubkey.toString() },
          update: {
            currentProtocol,
            usdcDeposited: BigInt(acc.usdcDeposited.toString()),
            lifetimeYield: BigInt(acc.lifetimeYield.toString()),
          },
          create: {
            vaultPda: v.pubkey.toString(),
            userWallet: acc.owner.toString(),
            currentProtocol,
            usdcDeposited: BigInt(acc.usdcDeposited.toString()),
            lifetimeYield: BigInt(acc.lifetimeYield.toString()),
            depositedAt: new Date(),
            apyAtEntry,
          },
        });
      } catch (err) {
        // Skip vaults that fail to deserialize (e.g. old 105-byte layout)
      }
    }
  } catch (err) {}
}
