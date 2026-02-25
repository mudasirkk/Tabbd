import type { Request, Response } from "express";
import { z } from "zod";
import {
  updateDiscountSettingsSchema,
  upsertProfileSchema,
} from "@shared/schema";
import { getUserId } from "../middleware/auth";
import { settingsService } from "./service";

export async function getMe(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const email = req.user?.email ?? null;
    const me = await settingsService.getMe(uid, email);
    res.json(me);
  } catch (err) {
    console.error("[ME] Error", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const { storeName } = upsertProfileSchema.parse(req.body);
    const user = await settingsService.updateProfile(uid, storeName);
    res.json({
      uid: user.id,
      email: user.email ?? null,
      storeName: user.storeName ?? null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    console.error("[PROFILE] Error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function updateDiscountSettings(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const body = updateDiscountSettingsSchema.parse(req.body);
    const user = await settingsService.updateDiscountSettings(userId, body);
    res.json({
      discountThresholdSeconds: user.discountThresholdSeconds,
      discountRate: user.discountRate,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    console.error("[SETTINGS] Error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
}
