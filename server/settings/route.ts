import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getMe,
  updateProfile,
  updateDiscountSettings,
} from "./controller";

const router = Router();

router.get("/api/me", requireAuth, getMe);
router.patch("/api/profile", requireAuth, updateProfile);
router.post("/api/settings/discount", requireAuth, updateDiscountSettings);

export const settingsRouter = router;
