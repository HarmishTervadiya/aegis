import type { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error("Unhandled error:", err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json(new ApiResponse(false, null, message));
};
