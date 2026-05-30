import type { Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../db.js";
import { program } from "../rpc.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const wallet = req.wallet!;

  const user = await prisma.user.upsert({
    where: { walletAddress: wallet },
    update: { updatedAt: new Date() },
    create: { walletAddress: wallet },
  });

  const trigger = await prisma.triggerConfig.findFirst({
    where: { userWallet: wallet },
  });

  const vault = await prisma.userVault.findFirst({
    where: { userWallet: wallet },
  });

  res.json(
    new ApiResponse(true, {
      wallet,
      profile: user,
      trigger,
      vault,
    }),
  );
});

export const updateMe = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const wallet = req.wallet!;
    // Note: The simple schema only has walletAddress and timestamps.
    const user = await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: { updatedAt: new Date() },
      create: { walletAddress: wallet },
    });
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
        yieldEarned: account.yieldEarned ? account.yieldEarned.toNumber() : 0,
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
