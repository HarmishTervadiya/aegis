import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_production";

export interface AuthRequest extends Request {
  wallet?: string;
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json(new ApiResponse(false, null, "Authorization header required"));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { wallet: string };
    req.wallet = decoded.wallet;
    next();
  } catch {
    res
      .status(401)
      .json(new ApiResponse(false, null, "Invalid or expired token"));
  }
};
