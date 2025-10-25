import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  if (!process.env.SQUARE_APPLICATION_SECRET) {
    console.error("CRITICAL: SQUARE_APPLICATION_SECRET environment variable is not set!");
    console.error("Square OAuth will not work without this secret.");
  }

  // Square OAuth callback - simplified
  app.get("/api/square/oauth/callback", async (req, res) => {
    console.log('[Square OAuth Callback] Received callback from Square');
    const { code, error } = req.query;
    
    console.log('[Square OAuth Callback] Code:', code ? 'present' : 'missing', 'Error:', error || 'none');
    
    if (error) {
      console.error('[Square OAuth Callback] ERROR from Square:', error);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Authorization Failed</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>Error: ${error}</p>
          <a href="/">Return to App</a>
        </body>
        </html>
      `);
    }
    
    if (!code) {
      console.error('[Square OAuth Callback] ERROR: Missing authorization code');
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Authorization Failed</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>No authorization code received</p>
          <a href="/">Return to App</a>
        </body>
        </html>
      `);
    }
    
    if (!process.env.SQUARE_APPLICATION_SECRET) {
      console.error('[Square OAuth Callback] CRITICAL ERROR: SQUARE_APPLICATION_SECRET is not set');
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Configuration Error</title></head>
        <body>
          <h1>Configuration Error</h1>
          <p>Square application secret is not configured. Please contact the administrator.</p>
          <a href="/">Return to App</a>
        </body>
        </html>
      `);
    }
    
    console.log('[Square OAuth Callback] SQUARE_APPLICATION_SECRET is present');
    
    try {
      console.log('[Square OAuth Callback] Exchanging authorization code for access token...');
      const tokenResponse = await fetch('https://connect.squareup.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Square-Version': '2024-10-17',
        },
        body: JSON.stringify({
          client_id: 'sq0idp-o0gFxi0LCTcztITa6DWf2g',
          client_secret: process.env.SQUARE_APPLICATION_SECRET,
          code: code,
          grant_type: 'authorization_code',
        }),
      });
      
      console.log('[Square OAuth Callback] Token exchange response status:', tokenResponse.status);
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('[Square OAuth Callback] ERROR: Token exchange failed with status', tokenResponse.status);
        console.error('[Square OAuth Callback] ERROR details:', JSON.stringify(errorData, null, 2));
        throw new Error('Failed to exchange authorization code for access token');
      }
      
      const tokenData = await tokenResponse.json();
      console.log('[Square OAuth Callback] Token exchange successful!');
      console.log('[Square OAuth Callback] Received merchant_id:', tokenData.merchant_id);
      console.log('[Square OAuth Callback] Access token received:', tokenData.access_token ? 'yes' : 'no');
      console.log('[Square OAuth Callback] Refresh token received:', tokenData.refresh_token ? 'yes' : 'no');
      
      console.log('[Square OAuth Callback] Saving tokens to database...');
      await storage.saveSquareToken({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null,
        merchantId: tokenData.merchant_id,
      });
      
      console.log('[Square OAuth Callback] Tokens saved successfully! Redirecting to app...');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Connected</title></head>
        <body>
          <script>
            window.location.href = '/?square_connected=true';
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('[Square OAuth Callback] FATAL ERROR during OAuth callback:', error);
      if (error instanceof Error) {
        console.error('[Square OAuth Callback] Error message:', error.message);
        console.error('[Square OAuth Callback] Error stack:', error.stack);
      }
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Square Authorization Failed</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>There was an error connecting to Square. Please try again.</p>
          <a href="/">Return to App</a>
        </body>
        </html>
      `);
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
