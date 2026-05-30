import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";
import { exec } from "child_process";
import { PublicKey } from "@solana/web3.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeTrigger } from "../utils/triggerMode.js";
import { cache } from "../cache.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  pollProtocolState,
  fetchActiveTriggers,
  evaluateTriggers,
} from "../services/watcher.service.js";
import { fireExecuteTrigger } from "../services/executor.service.js";

export const getHealth = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    new ApiResponse(true, {
      marginfi: cache.marginfi,
      kamino: cache.kamino,
      lastPollAt: cache.lastPollAt,
    }),
  );
});

export const getTriggers = asyncHandler(async (req: Request, res: Response) => {
  const triggers = Array.from(cache.activeTriggers.values()).map(
    serializeTrigger,
  );
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

    const trigger = cache.activeTriggers.get(req.params.owner as string);
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

    res.json(new ApiResponse(true, serializeTrigger(trigger)));
  },
);

export const getExecutions = asyncHandler(
  async (req: Request, res: Response) => {
    res.json(
      new ApiResponse(true, {
        executions: cache.recentExecutions,
        count: cache.recentExecutions.length,
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

  const toFire = evaluateTriggers();
  const results = [];

  for (const trigger of toFire) {
    const result = await fireExecuteTrigger(trigger);
    results.push({ owner: trigger.owner.toString(), result });
  }

  res.json(
    new ApiResponse(true, {
      polledAt: cache.lastPollAt,
      triggersEvaluated: cache.activeTriggers.size,
      triggered: toFire.length,
      results,
      message: "Manual crank completed",
    }),
  );
});

export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  res.json(
    new ApiResponse(true, {
      status: "ok",
      uptime: process.uptime(),
      lastPoll: cache.lastPollAt,
      triggers: cache.activeTriggers.size,
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

    const mint = process.env.VITE_USDC_MINT || process.env.USDC_MINT;
    if (!mint) {
      res
        .status(500)
        .json(new ApiResponse(false, null, "USDC_MINT not configured"));
      return;
    }

    const network = process.env.RPC_URL || "http://127.0.0.1:8899";
    const winPath = process.env.USERPROFILE || "C:\\Users\\harmi";
    // Convert C:\Users\harmi to /mnt/c/Users/harmi
    const wslPath =
      "/mnt/" +
      winPath.charAt(0).toLowerCase() +
      winPath.slice(2).replace(/\\/g, "/");
    const keypairPath = `${wslPath}/deploy-key.json`;

    logger.info(`[Mint USDC] Minting ${mint} to ${address} on ${network}`);

    exec(
      `wsl -e bash -lc "spl-token create-account ${mint} --owner ${address} --fee-payer ${keypairPath} --url ${network} || true; spl-token mint ${mint} 1000000 --recipient-owner ${address} --fee-payer ${keypairPath} --mint-authority ${keypairPath} --url ${network}"`,
      (err, stdout, stderr) => {
        if (err) {
          logger.error("[Mint USDC Error]:", err, stderr);
          res
            .status(500)
            .json(new ApiResponse(false, null, "Mint failed: " + stderr));
          return;
        }
        logger.info(`[Mint USDC Success]: ${stdout}`);
        res.json(new ApiResponse(true, null, "Mint successful"));
      },
    );
  },
);
