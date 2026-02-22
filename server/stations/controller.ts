import type { Request, Response } from "express";
import { z } from "zod";
import {
  insertStationSchema,
  reorderStationsSchema,
  updateStationSchema,
} from "@shared/schema";
import { getUserId } from "../middleware/auth";
import { toHttpError } from "./errors";
import { stationService } from "./service";

export async function listStations(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const data = await stationService.listStations(uid);
    res.json(data);
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function createStation(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const data = insertStationSchema.parse(req.body);
    const created = await stationService.createStation(uid, data);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function updateStation(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const patch = updateStationSchema.parse(req.body);
    const updated = await stationService.updateStation(uid, req.params.id, patch as any);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function deleteStation(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    await stationService.deleteStation(uid, req.params.id);
    res.status(204).send();
  } catch (err) {
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}

export async function reorderStations(req: Request, res: Response) {
  try {
    const uid = getUserId(req);
    const { stationIds } = reorderStationsSchema.parse(req.body);
    await stationService.reorderStations(uid, stationIds);
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
    const { status, message } = toHttpError(err);
    return res.status(status).json({ error: message });
  }
}
