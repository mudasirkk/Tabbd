import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Square OAuth callback handler - GET endpoint for Square redirect
  app.get("/api/square/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({ error: "Authorization code is required" });
      }

      // Exchange authorization code for access token
      // Use sandbox URL since we're using sandbox credentials
      const tokenResponse = await fetch("https://connect.squareupsandbox.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": "2024-10-17",
        },
        body: JSON.stringify({
          client_id: process.env.VITE_SQUARE_APPLICATION_ID,
          client_secret: process.env.SQUARE_APPLICATION_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Square token exchange failed:", error);
        // Return HTML page with error
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head><title>Square Connection Failed</title></head>
          <body>
            <script>
              sessionStorage.setItem('square_oauth_error', 'Failed to connect to Square');
              window.location.href = '/';
            </script>
          </body>
          </html>
        `);
      }

      const tokenData = await tokenResponse.json();
      
      // Return HTML page that stores tokens and redirects
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Connection Successful</title></head>
        <body>
          <script>
            sessionStorage.setItem('square_access_token', '${tokenData.access_token}');
            sessionStorage.setItem('square_merchant_id', '${tokenData.merchant_id}');
            sessionStorage.setItem('square_oauth_success', 'true');
            window.location.href = '/';
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in Square OAuth callback:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Error</title></head>
        <body>
          <script>
            sessionStorage.setItem('square_oauth_error', 'Internal server error');
            window.location.href = '/';
          </script>
        </body>
        </html>
      `);
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
