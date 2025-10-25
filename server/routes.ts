import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";

const base64Encode = (buffer: Buffer) => {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+/g, '');
};

const sha256 = (str: string) => {
  return createHash('sha256').update(str).digest();
};

export async function registerRoutes(app: Express): Promise<Server> {
  if (!process.env.SQUARE_APPLICATION_SECRET) {
    console.error("CRITICAL: SQUARE_APPLICATION_SECRET environment variable is not set!");
    console.error("Square OAuth will not work without this secret.");
  }

  // Generate OAuth values with PKCE
  app.get("/api/square/oauth/start", async (req, res) => {
    console.log('[Square OAuth] Generating PKCE values...');
    
    const codeVerifier = base64Encode(randomBytes(32));
    const codeChallenge = base64Encode(sha256(codeVerifier));
    const state = base64Encode(randomBytes(12));
    
    console.log('[Square OAuth] Code verifier generated');
    console.log('[Square OAuth] Code challenge:', codeChallenge);
    console.log('[Square OAuth] State:', state);
    
    res.json({
      squareCodeChallenge: codeChallenge,
      squareCodeVerifier: codeVerifier,
      squareState: state,
      baseURL: 'https://connect.squareup.com/',
      appId: 'sq0idp-o0gFxi0LCTcztITa6DWf2g',
    });
  });

  // Square OAuth callback
  app.get("/api/square/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      console.log('[Square OAuth] Callback received');
      console.log('[Square OAuth] Code:', code ? 'present' : 'missing');
      console.log('[Square OAuth] State:', state);
      
      // Parse cookies
      const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>) || {};
      
      const expectedState = cookies['square-state'];
      const codeVerifier = cookies['square-code-verifier'];
      
      // Validate state
      if (!state || state !== expectedState) {
        console.error('[Square OAuth] Invalid state parameter');
        return res.status(400).send("Invalid state parameter");
      }
      
      if (!code) {
        console.error('[Square OAuth] Missing authorization code');
        return res.status(400).send("Missing authorization code");
      }
      
      // Exchange code for access token
      console.log('[Square OAuth] Exchanging code for token...');
      const tokenResponse = await fetch("https://connect.squareup.com/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: "sq0idp-o0gFxi0LCTcztITa6DWf2g",
          client_secret: process.env.SQUARE_APPLICATION_SECRET,
          code: code,
          grant_type: "authorization_code",
          code_verifier: codeVerifier, // PKCE
        }),
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        console.error("[Square OAuth] Error from Square:", tokenData);
        return res.status(400).json(tokenData);
      }
      
      console.log("[Square OAuth] Tokens received successfully");
      console.log("[Square OAuth] Merchant ID:", tokenData.merchant_id);
      
      // Save tokens in database
      await storage.saveSquareToken({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null,
        merchantId: tokenData.merchant_id,
      });
      
      console.log("[Square OAuth] Tokens saved to database");
      
      // Clear cookies and redirect
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Connected</title></head>
        <body>
          <script>
            document.cookie = 'square-code-verifier=; Max-Age=0; path=/';
            document.cookie = 'square-state=; Max-Age=0; path=/';
            window.location.href = '/?square_connected=true';
          </script>
        </body>
        </html>
      `);
      
    } catch (error) {
      console.error("[Square OAuth] Callback error:", error);
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

  const httpServer = createServer(app);

  return httpServer;
}
