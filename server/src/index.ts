import express from "express";
import cors from "cors";
import cron from "node-cron";
import dotenv from "dotenv";

import { validateEnv } from "./utils/validateEnv.js";
import { cache } from "./cache.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import systemRoutes from "./routes/system.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

dotenv.config();
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;
const POLL = parseInt(process.env.POLL_INTERVAL_SECONDS || "15");

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api", systemRoutes);

app.use(errorHandler);

async function start() {
  console.log("Aegis backend starting...");

  // Initial poll on startup so API is immediately populated
  // await pollProtocolState();
  // await fetchActiveTriggers();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Polling every ${POLL}s`);
    console.log(`MarginFi util: ${cache.marginfi.utilizationPct.toFixed(2)}%`);
    console.log(`Kamino util:   ${cache.kamino.utilizationPct.toFixed(2)}%`);
    console.log(`Active triggers: ${cache.activeTriggers.size}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
