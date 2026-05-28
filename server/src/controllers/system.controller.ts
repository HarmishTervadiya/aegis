import type { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeTrigger } from "../utils/triggerMode.js";
import { cache } from "../cache.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

  res.json(
    new ApiResponse(true, {
      polledAt: cache.lastPollAt,
      triggersEvaluated: cache.activeTriggers.size,
      triggered: 0,
      results: [],
      message: "Crank logic (Module 2) is not implemented yet.",
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
