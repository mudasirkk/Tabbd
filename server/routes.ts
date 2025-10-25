import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

const base64Encode = (str: Buffer) => {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+/g, '');
};

const getAuthUrlValues = () => {
  const codeVerifier = base64Encode(crypto.randomBytes(32));

  const sha256 = (buffer: string) => {
    return crypto.createHash('sha256').update(buffer).digest();
  };

  const codeChallenge = base64Encode(sha256(codeVerifier));
  const state = base64Encode(crypto.randomBytes(12));

  return {
    squareCodeChallenge: codeChallenge,
    squareCodeVerifier: codeVerifier,
    squareState: state,
    baseURL: 'https://connect.squareupsandbox.com/',
    appId: 'sandbox-sq0idb-4KygwAQgkc2WsOIEBox3tw',
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Square OAuth Routes
  
  // GET /api/square/auth-values - Get OAuth PKCE values
  app.get("/api/square/auth-values", async (req, res) => {
    try {
      const authValues = getAuthUrlValues();
      res.json(authValues);
    } catch (error) {
      console.error("Error generating auth values:", error);
      res.status(500).json({ error: "Failed to generate auth values" });
    }
  });

  // GET /api/square/oauth/callback - Handle OAuth callback
  app.get("/api/square/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).send("Missing code or state");
      }

      // For now, just redirect back to the app
      // Later we'll exchange the code for an access token
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Connection</title></head>
        <body>
          <script>
            sessionStorage.setItem('square_auth_code', '${code}');
            sessionStorage.setItem('square_auth_state', '${state}');
            window.location.href = '/';
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in OAuth callback:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Menu Items API Routes
  
  // GET /api/menu-items - Get all menu items
  app.get("/api/menu-items", async (req, res) => {
    try {
      const items = await storage.getAllMenuItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  // POST /api/menu-items - Create a new menu item
  app.post("/api/menu-items", async (req, res) => {
    try {
      const validatedData = insertMenuItemSchema.parse(req.body);
      const item = await storage.createMenuItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating menu item:", error);
      res.status(400).json({ error: "Invalid menu item data" });
    }
  });

  // PATCH /api/menu-items/:id - Update a menu item
  app.patch("/api/menu-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMenuItemSchema.parse(req.body);
      const item = await storage.updateMenuItem(id, validatedData);
      if (!item) {
        return res.status(404).json({ error: "Menu item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating menu item:", error);
      res.status(500).json({ error: "Failed to update menu item" });
    }
  });

  // DELETE /api/menu-items/:id - Delete a menu item
  app.delete("/api/menu-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMenuItem(id);
      if (!deleted) {
        return res.status(404).json({ error: "Menu item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      res.status(500).json({ error: "Failed to delete menu item" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
