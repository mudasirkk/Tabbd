import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import {
  insertMenuItemSchema,
  updateMenuItemSchema,
} from "@shared/schema";
import { requireAuth, getUserId } from "./middleware/auth";
import { storage } from "./storage";
import { sessionsRouter } from "./sessions/route";
import { stationsRouter } from "./stations/route";
import { customersRouter } from "./customers/route";
import { settingsRouter } from "./settings/route";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(sessionsRouter);
  app.use(stationsRouter);
  app.use(customersRouter);
  app.use(settingsRouter);

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

  return createServer(app);
}
