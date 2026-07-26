import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

/** GET /api/health — liveness/readiness probe. */
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
