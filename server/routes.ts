import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import {
  insertMenuItemSchema,
  insertStationSchema,
  startSessionSchema,
  addSessionItemSchema,
  updateMenuItemSchema,
  updateStationSchema,
  upsertProfileSchema,
} from "@shared/schema";
import { requireAuth, getUserId } from "./middleware/auth";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Bootstrap user row
  app.get("/api/me", requireAuth, async (req, res) => {
   try {
    const uid = getUserId(req);
    const email = req.user?.email ?? null;

    await storage.upsertUser({id: uid, email });
    const user = await storage.getUserById(uid);

    res.json({ uid, email, storeName: user?.storeName ?? null});
   } catch(err) {
    console.error("[ME] Error", err);
    res.status(500).json({ error: "Failed to load profile" })
   }
  });
  
  // Profile
  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const uid = getUserId(req);
      const { storeName } = upsertProfileSchema.parse(req.body);
      const user = await storage.updateProfile(uid, storeName);
      res.json({ uid: user.id, email: user.email ?? null, storeName: user.storeName ?? null});
    } catch (err) {
      if(err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      console.error("[PROFILE] Error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Menu CRUD

  //Get Menu
  app.get("/api/menu", requireAuth, async (req, res) => {
    const uid = getUserId(req);
    res.json(await storage.listMenu(uid));
  });

  //Create
  app.post("/api/menu", requireAuth, async (req, res) => {
    try {
      const uid = getUserId(req);
      const data = insertMenuItemSchema.parse(req.body);
      const created = await storage.createMenuItem(uid, data as any);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      res.status(500).json({ error: "Failed to create menu item" });
    }
  });

  //Update
  app.patch("/api/menu/:id", requireAuth, async (req, res) => {
    try{
      const uid = getUserId(req);
      const patch = updateMenuItemSchema.parse(req.body);
      const updated = await storage.updateMenuItem(uid, req.params.id, patch as any);
      if(!updated) return res.status(404).json({ error: "Menu item not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      res.status(500).json({ error: "Failed to update menu item" });
    }
  });

  //Delete
  app.delete("/api/menu/:id", requireAuth, async (req, res) => {
    const uid = getUserId(req);
    const ok = await storage.deleteMenuItem(uid, req.params.id);
    if (!ok) return res.status(404).json({ error: "Menu item not found" });
    res.status(204).send();
  });

  // Stations(returns stations + activeSession + items related)

  //List Sessions
  app.get("/api/stations", requireAuth, async(req, res) => {
    try{
      const uid = getUserId(req);
      const data = await storage.listStations(uid);
      const withSessions = await Promise.all(
        data.map(async (st) => {
          const activeSession = await storage.getActiveSessionForStation(uid, st.id);
          const items = activeSession ? await storage.listSessionItems(uid, activeSession.id) : [];
          return { ...st, activeSession: activeSession ? { ...activeSession, items } : null };
        })
      );
      res.json(withSessions);
    } catch(err) {
      console.error("[STATIONS] list error:", err);
      res.status(500).json({ error: "Failed to list stations" });
    }
  });

  //Create
  app.post("/api/stations", requireAuth, async (req, res) => {
    try{
      const uid = getUserId(req);
      const data = insertStationSchema.parse(req.body);
      const created = await storage.createStation(uid, data as any);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      res.status(500).json({ error: "Failed to create station" });
    }
  });

  //Update
  app.patch("/api/stations/:id", requireAuth, async (req, res) => {
    try {
      const uid = getUserId(req);
      const patch = updateStationSchema.parse(req.body);
      const updated = await storage.updateStation(uid, req.params.id, patch as any);
      if (!updated) return res.status(404).json({ error: "Station not found" });
      res.json(updated);
    } catch(err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      res.status(500).json({ error: "Failed to update station" });
    }
  });
  
  // Sessions

  //Start
  app.post("/api/sessions/start", requireAuth, async (req, res) => {
    try {
      const uid = getUserId(req);
      const { stationId, startedAt } = startSessionSchema.parse(req.body);
      const start = startedAt ? new Date(startedAt) : new Date();
      res.status(201).json(await storage.startSession(uid, stationId, start));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      res.status(500).json({ error: "Failed to start session" });
    }
  });

  //Pause
  app.post("/api/sessions/:id/pause", requireAuth, async (req, res) => {
    const uid = getUserId(req);
    const session = await storage.pauseSession(uid, req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found or not active" });
    res.json(session);
  });

  //Resume
  app.post("/api/sessions/:id/resume", requireAuth, async (req, res) => {
    const uid = getUserId(req);
    const session = await storage.resumeSession(uid, req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found or not paused" });
    res.json(session);
  });

  //Close
  app.post("/api/sessions/:id/close", requireAuth, async (req, res) => {
    const uid = getUserId(req);
    const pricingTier = z.enum(["solo", "group"]).optional().parse(req.body?.pricingTier);
    const session = await storage.closeSession(uid, req.params.id, pricingTier);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  });

  //Items
  app.post("/api/sessions/:id/items", requireAuth, async (req, res) => {
    try {
      const uid = getUserId(req);
      const body = addSessionItemSchema.parse(req.body);
      const result = await storage.addItemToSession(uid, req.params.id, body);
      res.status(201).json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.flatten() });
      res.status(400).json({ error: err?.message ?? "Failed to add item" });
    }
  });

  return createServer(app);
}