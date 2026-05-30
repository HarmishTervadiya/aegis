import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { connection, crankKeypair } from "../rpc.js";
import { PublicKey } from "@solana/web3.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../db.js";
import { cache } from "../cache.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  pollProtocolState,
  fetchActiveTriggers,
  evaluateTriggers,
} from "../services/watcher.service.js";
import { fireExecuteTrigger } from "../services/executor.service.js";

export const getHealth = asyncHandler(async (req: Request, res: Response) => {
  const result = await prisma.userVault.aggregate({
    _sum: {
      lifetimeYield: true,
    },
  });

  const projectYield = result._sum.lifetimeYield
    ? Number(result._sum.lifetimeYield)
    : 0;

  res.setHeader("Cache-Control", "no-store");
  res.json(
    new ApiResponse(true, {
      marginfi: cache.marginfi,
      kamino: cache.kamino,
      lastPollAt: cache.lastPollAt,
      projectYield,
    }),
  );
});

export const getTriggers = asyncHandler(async (req: Request, res: Response) => {
  const triggers = await prisma.triggerConfig.findMany();
  res.json(new ApiResponse(true, { triggers, count: triggers.length }));
});

export const getTriggerByOwner = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      new PublicKey(req.params.owner as string);
    } catch {
      res.status(400).json(new ApiResponse(false, null, "Invalid public key"));
      return;
    }

    const trigger = await prisma.triggerConfig.findFirst({
      where: { userWallet: req.params.owner as string },
    });

    if (!trigger) {
      res
        .status(404)
        .json(
          new ApiResponse(
            false,
            null,
            "No active trigger found for this address",
          ),
        );
      return;
    }

    res.json(new ApiResponse(true, trigger));
  },
);

export const getExecutions = asyncHandler(
  async (req: Request, res: Response) => {
    const executions = await prisma.executionRecord.findMany({
      orderBy: { firedAt: "desc" },
      take: 50,
    });

    const mapped = executions.map((e) => ({
      owner: e.userWallet,
      mode: e.mode,
      marginfiUtil: e.marginfiUtil,
      kaminoUtil: e.kaminoUtil,
      firedAt: e.firedAt.toISOString(),
      txSignature: e.txSignature,
      yieldEarned: e.yieldEarned,
    }));

    res.json(
      new ApiResponse(true, {
        executions: mapped,
        count: mapped.length,
      }),
    );
  },
);

let lastManualCrank = 0;
const MANUAL_CRANK_COOLDOWN_MS = 5000;

export const postCrank = asyncHandler(async (req: Request, res: Response) => {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    res.status(401).json(new ApiResponse(false, null, "Unauthorized"));
    return;
  }

  if (Date.now() - lastManualCrank < MANUAL_CRANK_COOLDOWN_MS) {
    res.status(429).json(new ApiResponse(false, null, "Crank cooldown active"));
    return;
  }
  lastManualCrank = Date.now();

  await pollProtocolState();
  await fetchActiveTriggers();

  const toFire = await evaluateTriggers();
  const results = [];

  for (const trigger of toFire) {
    const result = await fireExecuteTrigger(trigger as any);
    results.push({ owner: trigger.trigger.owner.toString(), result });
  }

  const triggerCount = await prisma.triggerConfig.count();

  res.json(
    new ApiResponse(true, {
      polledAt: cache.lastPollAt,
      triggersEvaluated: triggerCount,
      triggered: toFire.length,
      results,
      message: "Manual crank completed",
    }),
  );
});

export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const triggers = await prisma.triggerConfig.count();
  res.json(
    new ApiResponse(true, {
      status: "ok",
      uptime: process.uptime(),
      lastPoll: cache.lastPollAt,
      triggers,
    }),
  );
});

export const postMintUsdc = asyncHandler(
  async (req: Request, res: Response) => {
    const { address } = req.body;
    if (!address) {
      res.status(400).json(new ApiResponse(false, null, "Address required"));
      return;
    }

    const mintStr = process.env.VITE_USDC_MINT || process.env.USDC_MINT;
    if (!mintStr) {
      res
        .status(500)
        .json(new ApiResponse(false, null, "USDC_MINT not configured"));
      return;
    }

    try {
      const mint = new PublicKey(mintStr);
      const recipient = new PublicKey(address);

      logger.info(`[Mint USDC] Minting ${mint.toString()} to ${recipient.toString()}`);

      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        crankKeypair,
        mint,
        recipient
      );

      const signature = await mintTo(
        connection,
        crankKeypair,
        mint,
        tokenAccount.address,
        crankKeypair,
        1_000_000_000_000 // 1,000,000 USDC (6 decimals)
      );

      logger.info(`[Mint USDC Success]: ${signature}`);
      res.json(new ApiResponse(true, { signature }, "Mint successful"));
    } catch (err: any) {
      logger.error("[Mint USDC Error]:", err.message);
      res.status(500).json(new ApiResponse(false, null, "Mint failed: " + err.message));
    }
  },
);
