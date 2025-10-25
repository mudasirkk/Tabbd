import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  if (!process.env.SQUARE_APPLICATION_SECRET) {
    console.error(
      "CRITICAL: SQUARE_APPLICATION_SECRET environment variable is not set!",
    );
    console.error("Square OAuth will not work without this secret.");
  }

  // Generate OAuth state for CSRF protection
  app.get("/api/square/oauth/start", async (req, res) => {
    console.log("[Square OAuth] Generating state...");

    const state = randomBytes(32).toString("hex");

    console.log("[Square OAuth] State:", state);

    res.json({
      state: state,
      baseURL: "https://connect.squareup.com/",
      appId: "sq0idp-o0gFxi0LCTcztITa6DWf2g",
    });
  });

  // Square OAuth callback
  app.get("/api/square/oauth/callback", async (req, res) => {
    try {
      const { code, error, error_description } = req.query;

      console.log("[Square OAuth] Callback received");

      // Handle Square authorization denial
      if (error) {
        console.error(
          "[Square OAuth] Error from Square:",
          error_description || error,
        );
        return res
          .status(400)
          .send(`Authorization failed: ${error_description || error}`);
      }

      if (!code) {
        console.error("[Square OAuth] Missing authorization code");
        return res.status(400).send("Missing authorization code");
      }

      console.log("[Square OAuth] Exchanging code for token...");

      // Exchange authorization code for access token
      const tokenResponse = await fetch(
        "https://connect.squareup.com/oauth2/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: "sq0idp-o0gFxi0LCTcztITa6DWf2g",
            client_secret: process.env.SQUARE_APPLICATION_SECRET,
            code,
            grant_type: "authorization_code",
            redirect_uri: "https://pool-cafe-manager-TalhaNadeem001.replit.app/api/square/oauth/callback",
          }),
        },
      );

      const tokenData = await tokenResponse.json();

      console.log(
        "[Square OAuth] Full token response:",
        JSON.stringify(tokenData, null, 2),
      );

      if (tokenData.error) {
        console.error("[Square OAuth] Error exchanging code:", tokenData);
        return res.status(400).json(tokenData);
      }

      console.log("[Square OAuth] Tokens received successfully");
      console.log(
        "[Square OAuth] Access token:",
        tokenData.access_token ? "present" : "MISSING",
      );
      console.log("[Square OAuth] Merchant ID:", tokenData.merchant_id);

      // Validate all required fields exist
      if (!tokenData.access_token || !tokenData.merchant_id) {
        console.error("[Square OAuth] ERROR: Missing required fields!");
        console.error("[Square OAuth] access_token:", tokenData.access_token);
        console.error("[Square OAuth] merchant_id:", tokenData.merchant_id);
        return res.status(500).json({
          error: "Invalid token response from Square",
          tokenData: tokenData,
        });
      }

      // Save tokens to database
      await storage.saveSquareToken({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null,
        merchantId: tokenData.merchant_id,
      });

      console.log("[Square OAuth] Tokens saved to database");

      // Redirect user to success page
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Square Connected</title></head>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>✅ Square account connected successfully!</h2>
            <script>
              window.location.href = '/?square_connected=true';
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("[Square OAuth] Callback error:", error);

      // Return the error structure for debugging
      if (error && typeof error === "object") {
        return res.status(500).json({
          error: "OAuth callback failed",
          details: error,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }

      res.status(500).send("Server error during OAuth callback");
    }
  });

  // GET /api/square/status - Check Square connection status
  app.get("/api/square/status", async (req, res) => {
    try {
      const token = await storage.getSquareToken();
      res.json({
        connected: !!token,
        merchantId: token?.merchantId || null,
      });
    } catch (error) {
      console.error("Error checking Square status:", error);
      res.status(500).json({ error: "Failed to check Square status" });
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

  // DELETE /api/menu-items - Clear all menu items
  app.delete("/api/menu-items", async (req, res) => {
    try {
      await storage.clearAllMenuItems();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing menu items:", error);
      res.status(500).json({ error: "Failed to clear menu items" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
