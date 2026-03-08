import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getMe,
  updateProfile,
  updateLogo,
  updateDiscountSettings,
} from "./controller";

const router = Router();

router.get("/api/me", requireAuth, getMe);
router.patch("/api/profile", requireAuth, updateProfile);
router.patch("/api/profile/logo", requireAuth, updateLogo);
router.post("/api/settings/discount", requireAuth, updateDiscountSettings);

export const settingsRouter = router;
