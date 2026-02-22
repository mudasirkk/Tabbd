import type { Request, Response } from "express";
import { z } from "zod";
import {
  addSessionItemSchema,
  removeSessionItemSchema,
  startSessionSchema,
  transferSessionSchema,
} from "@shared/schema";
import { getUserId } from "../middleware/auth";
import { toHttpError } from "./errors";
import { sessionService } from "./service";

export async function startSession(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const { stationId, pricingTier, startedAt } = startSessionSchema.parse(req.body);
    const start = startedAt ? new Date(startedAt) : new Date();
    const created = await sessionService.startSession(uid, stationId, pricingTier, start);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function pauseSession(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const session = await sessionService.pauseSession(uid, req.params.id);
    res.json(session);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function resumeSession(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const session = await sessionService.resumeSession(uid, req.params.id);
    res.json(session);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function closeSession(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const session = await sessionService.closeSession(uid, req.params.id);
    res.json(session);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function transferSession(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const { destinationStationId } = transferSessionSchema.parse(req.body);
    const session = await sessionService.transferSession(uid, req.params.id, destinationStationId);
    res.json(session);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function addSessionItem(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const body = addSessionItemSchema.parse(req.body);
    const result = await sessionService.addSessionItem(uid, req.params.id, body);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function removeSessionItem(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const { menuItemId, qty } = removeSessionItemSchema.parse(req.body);
    const result = await sessionService.removeSessionItem(uid, req.params.id, menuItemId, qty);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function getSessionHistory(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const history = await sessionService.listHistory(uid);
    res.json(history);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}
