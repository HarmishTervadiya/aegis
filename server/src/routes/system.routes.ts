import { Router } from "express";
import {
  getHealth,
  getTriggers,
  getTriggerByOwner,
  getExecutions,
  postCrank,
  getStatus,
  postMintUsdc,
} from "../controllers/system.controller.js";

const router = Router();

router.get("/health", getHealth);
router.get("/triggers", getTriggers);
router.get("/triggers/:owner", getTriggerByOwner);
router.get("/executions", getExecutions);
router.post("/crank", postCrank);
router.get("/status", getStatus);
router.post("/mint-usdc", postMintUsdc);

export default router;
