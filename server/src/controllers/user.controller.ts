import type { Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { getOrCreateUser, updateUser } from "../utils/users.js";
import { cache } from "../cache.js";
import { program } from "../rpc.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const wallet = req.wallet!;
  const user = getOrCreateUser(wallet);

  updateUser(wallet, { lastSeenAt: new Date().toISOString() });
  const trigger = cache.activeTriggers.get(wallet);

  res.json(
    new ApiResponse(true, {
      wallet,
      profile: user,
      trigger: trigger
        ? {
            mode: trigger.mode.defense ? "Defense" : "Offense",
            isActive: trigger.isActive,
            defenseThresholdBps: trigger.defenseThresholdBps,
            offenseThresholdBps: trigger.offenseThresholdBps,
            executionCount: trigger.executionCount,
          }
        : null,
    }),
  );
});

export const updateMe = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const wallet = req.wallet!;
    const updates = req.body;
    const user = updateUser(wallet, updates);
    res.json(new ApiResponse(true, { wallet, profile: user }));
  },
);

export const getMyExecutions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const wallet = req.wallet!;

    const logs = await (program.account as any).triggerLog.all([
      {
        memcmp: {
          offset: 8,
          bytes: new PublicKey(wallet).toBase58(),
        },
      },
    ]);

    const formatted = logs
      .map(({ account, publicKey }: any) => ({
        pda: publicKey.toString(),
        executedAt: account.executedAt.toNumber(),
        mode: account.mode.defense ? "Defense" : "Offense",
        fromProtocol: account.fromProtocol.marginFi ? "MarginFi" : "Kamino",
        toProtocol: account.toProtocol.kamino ? "Kamino" : "MarginFi",
        amountMoved: account.amountMoved.toNumber(),
        marginfiUtilBps: account.marginfiUtilizationBps.toNumber(),
        kaminoUtilBps: account.kaminoUtilizationBps.toNumber(),
      }))
      .sort((a: any, b: any) => b.executedAt - a.executedAt);

    res.json(
      new ApiResponse(true, {
        wallet,
        executions: formatted,
        count: formatted.length,
      }),
    );
  },
);
