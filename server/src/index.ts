import { logger } from "./utils/logger.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import dotenv from "dotenv";

import { validateEnv } from "./utils/validateEnv.js";
import { cache } from "./cache.js";
import { prisma } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import systemRoutes from "./routes/system.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

import {
  initProtocolIndexer,
  initTriggerIndexer,
  initVaultIndexer,
} from "./services/watcher.service.js";
import { fireExecuteTrigger } from "./services/executor.service.js";

dotenv.config();
validateEnv();

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT || 3001;
const POLL = parseInt(process.env.POLL_INTERVAL_SECONDS || "15");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true, // allow cookies cross-origin
  }),
);
app.use(cookieParser());
app.use(express.json());

// REST API
app.use("/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api", systemRoutes);

app.use(errorHandler);

// Cron jobs
async function start() {
  logger.info("Aegis backend starting...");

  // Initial poll on startup so API is immediately populated
  await initProtocolIndexer();
  await initTriggerIndexer();
  await initVaultIndexer();

  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Polling every ${POLL}s`);
    logger.info(`MarginFi util: ${cache.marginfi.utilizationPct.toFixed(2)}%`);
    logger.info(`Kamino util:   ${cache.kamino.utilizationPct.toFixed(2)}%`);
    prisma.triggerConfig.count().then((count) => {
      logger.info(`Active triggers: ${count}`);
    });
  });
}

start().catch((err) => {
  logger.error("Failed to start:", err);
  process.exit(1);
});
