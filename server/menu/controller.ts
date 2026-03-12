import type { Request, Response } from "express";
import { z } from "zod";
import { insertMenuItemSchema, updateMenuItemSchema } from "@shared/schema";
import { getUserId } from "../middleware/auth";
import { toHttpError, MenuNotFoundError } from "./errors";
import { menuService } from "./service";

export async function listMenu(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const items = await menuService.listMenu(uid);
    res.json(items);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function createMenuItem(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const data = insertMenuItemSchema.parse(req.body);
    const created = await menuService.createMenuItem(uid, data as any);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function updateMenuItem(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const patch = updateMenuItemSchema.parse(req.body);
    const updated = await menuService.updateMenuItem(uid, req.params.id, patch as any);
    if (!updated) throw new MenuNotFoundError("Menu item not found");
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function deleteMenuItem(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const ok = await menuService.deleteMenuItem(uid, req.params.id);
    if (!ok) throw new MenuNotFoundError("Menu item not found");
    res.status(204).send();
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}
