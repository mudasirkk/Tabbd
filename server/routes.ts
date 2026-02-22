import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import {
  insertMenuItemSchema,
  insertStationSchema,
  updateMenuItemSchema,
  updateStationSchema,
  upsertProfileSchema,
} from "@shared/schema";
import { requireAuth, getUserId } from "./middleware/auth";
import { storage } from "./storage";
import { sessionsRouter } from "./sessions/route";
import { sessionService } from "./sessions/service";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(sessionsRouter);

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
          const activeSession = await sessionService.getActiveSessionWithItems(uid, st.id);
          return { ...st, activeSession };
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

  //Delete
  app.delete("/api/stations/:id", requireAuth, async (req, res) => {
    try {
      const uid = getUserId(req);
      const ok = await storage.deleteStation(uid, req.params.id);
      if (!ok) return res.status(404).json({ error: "Station not found" });
      res.status(204).send();
    } catch (err: any) {
      // storage throws this when station has active session
      if (err?.message?.includes("active session")) {
        return res.status(400).json({ error: err.message });
      }
      console.error("[STATIONS] delete error:", err);
      res.status(500).json({ error: "Failed to delete station" });
    }
  });  

  return createServer(app);
}
