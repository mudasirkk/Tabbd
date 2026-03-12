import type { Request, Response } from "express";
import { z } from "zod";
import { getUserId } from "../middleware/auth";
import { toHttpError } from "./errors";
import { cloverService } from "./service";

export async function getAuthUrl(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const url = cloverService.generateAuthUrl(uid);
    res.json({ url });
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function handleCallback(req: Request, res: Response) {
  try {
    const querySchema = z.object({
      code: z.string().min(1),
      state: z.string().min(1),
      merchant_id: z.string().min(1),
    });
    const { code, state, merchant_id } = querySchema.parse(req.query);

    await cloverService.handleCallback(code, state, merchant_id);
    return res.redirect("/settings?clover=connected");
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function disconnect(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    await cloverService.disconnect(uid);
    res.status(204).send();
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function syncPreview(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const preview = await cloverService.syncPreview(uid);
    res.json(preview);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function syncApply(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const result = await cloverService.syncApply(uid, req.body);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function push(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const result = await cloverService.push(uid, req.body);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}
