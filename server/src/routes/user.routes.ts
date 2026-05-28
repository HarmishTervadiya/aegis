import { Router } from "express";
import {
  getMe,
  updateMe,
  getMyExecutions,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);
router.get("/me/executions", requireAuth, getMyExecutions);

export default router;
