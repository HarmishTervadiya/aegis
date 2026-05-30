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
  // Prefer HttpOnly cookie; fall back to Bearer header for server-side tools
  const cookieToken = (req as any).cookies?.aegis_token;
  const headerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;

  const token = cookieToken || headerToken;

  if (!token) {
    res
      .status(401)
      .json(new ApiResponse(false, null, "Authorization required"));
    return;
  }

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
