import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getAuthUrl,
  handleCallback,
  disconnect,
  syncPreview,
  syncApply,
  push,
} from "./controller";

const router = Router();

router.get("/api/clover/auth-url", requireAuth, getAuthUrl);
router.get("/api/clover/callback", handleCallback);
router.post("/api/clover/disconnect", requireAuth, disconnect);
router.post("/api/clover/sync/preview", requireAuth, syncPreview);
router.post("/api/clover/sync/apply", requireAuth, syncApply);
router.post("/api/clover/push", requireAuth, push);

export const cloverRouter = router;
