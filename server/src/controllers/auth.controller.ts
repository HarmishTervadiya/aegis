import type { Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_production";
const JWT_EXPIRY = "24h";

interface NonceData {
  nonce: string;
  createdAt: number;
}

const nonces = new Map<string, NonceData>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of nonces.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      nonces.delete(key);
    }
  }
}, 60_000);

export const getNonce = asyncHandler(async (req: Request, res: Response) => {
  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    res
      .status(400)
      .json(new ApiResponse(false, null, "wallet query param required"));
    return;
  }

  try {
    new PublicKey(wallet);
  } catch {
    res
      .status(400)
      .json(new ApiResponse(false, null, "Invalid wallet address"));
    return;
  }

  const nonce = `aegis-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  nonces.set(wallet, { nonce, createdAt: Date.now() });

  res.json(
    new ApiResponse(true, {
      nonce,
      message: `Sign this message to authenticate with Aegis: ${nonce}`,
    }),
  );
});

export const verifySignature = asyncHandler(
  async (req: Request, res: Response) => {
    const { wallet, signature } = req.body;

    if (!wallet || !signature) {
      res
        .status(400)
        .json(new ApiResponse(false, null, "wallet and signature required"));
      return;
    }

    const stored = nonces.get(wallet);
    if (!stored) {
      res
        .status(401)
        .json(
          new ApiResponse(false, null, "No nonce found — request a new one"),
        );
      return;
    }

    if (Date.now() - stored.createdAt > 5 * 60 * 1000) {
      nonces.delete(wallet);
      res
        .status(401)
        .json(
          new ApiResponse(false, null, "Nonce expired — request a new one"),
        );
      return;
    }

    try {
      const message = new TextEncoder().encode(
        `Sign this message to authenticate with Aegis: ${stored.nonce}`,
      );
      const pubkeyBytes = new PublicKey(wallet).toBytes();
      const sigBytes = bs58.decode(signature);

      const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);

      if (!valid) {
        res.status(401).json(new ApiResponse(false, null, "Invalid signature"));
        return;
      }

      nonces.delete(wallet);

      const token = jwt.sign({ wallet }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      res.json(new ApiResponse(true, { token, wallet, expiresIn: JWT_EXPIRY }));
    } catch (err: any) {
      res
        .status(401)
        .json(
          new ApiResponse(
            false,
            null,
            err.message || "Signature verification failed",
          ),
        );
    }
  },
);
