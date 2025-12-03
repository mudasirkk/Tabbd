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

      // Automatically sync menu from Square catalog
      console.log("[Square OAuth] Starting automatic menu sync...");
      const syncResult = await syncMenuFromSquare(tokenData.access_token);
      if (syncResult.success) {
        console.log(`[Square OAuth] Menu synced successfully: ${syncResult.itemCount} items imported`);
      } else {
        console.error("[Square OAuth] Menu sync failed:", syncResult.error);
      }

      // Redirect user to success page
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Square Connected</title></head>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Square account connected successfully!</h2>
            <p>${syncResult.success ? `${syncResult.itemCount} menu items imported from your catalog.` : 'Menu sync is pending.'}</p>
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

  // DELETE /api/square/disconnect - Disconnect Square account
  app.delete("/api/square/disconnect", async (req, res) => {
    try {
      await storage.deleteSquareToken();
      console.log("[Square] Account disconnected");
      
      // Clear all menu items when disconnecting
      await storage.clearAllMenuItems();
      console.log("[Square] Menu items cleared");
      
      res.json({ success: true, message: "Square account disconnected and menu cleared" });
    } catch (error) {
      console.error("Error disconnecting Square:", error);
      res.status(500).json({ error: "Failed to disconnect Square account" });
    }
  });

  // GET /api/square/locations - Fetch Square locations
  app.get("/api/square/locations", async (req, res) => {
    try {
      const token = await storage.getSquareToken();
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      console.log("[Square Locations] Fetching locations...");

      const response = await fetch(
        "https://connect.squareup.com/v2/locations",
        {
          method: "GET",
          headers: {
            "Square-Version": "2024-09-19",
            "Authorization": `Bearer ${token.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Square Locations] Error response:", errorData);
        return res.status(response.status).json({ error: "Failed to fetch Square locations", details: errorData });
      }

      const data = await response.json();
      console.log(`[Square Locations] Fetched ${data.locations?.length || 0} locations`);

      res.json(data);
    } catch (error) {
      console.error("[Square Locations] Error:", error);
      res.status(500).json({ error: "Failed to fetch Square locations" });
    }
  });

  // GET /api/square/devices - Fetch paired Square Terminal devices
  app.get("/api/square/devices", async (req, res) => {
    try {
      const token = await storage.getSquareToken();
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      console.log("[Square Devices] Fetching devices...");

      const response = await fetch(
        "https://connect.squareup.com/v2/devices/codes",
        {
          method: "GET",
          headers: {
            "Square-Version": "2024-09-19",
            "Authorization": `Bearer ${token.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Square Devices] Error response:", errorData);
        return res.status(response.status).json({ error: "Failed to fetch Square devices", details: errorData });
      }

      const data = await response.json();
      console.log(`[Square Devices] Fetched ${data.device_codes?.length || 0} device codes`);

      res.json(data);
    } catch (error) {
      console.error("[Square Devices] Error:", error);
      res.status(500).json({ error: "Failed to fetch Square devices" });
    }
  });

  // POST /api/square/terminals/checkouts - Send payment to Square Terminal reader
  app.post("/api/square/terminals/checkouts", async (req, res) => {
    try {
      const token = await storage.getSquareToken();
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      const { deviceId, amount, referenceId, note } = req.body;

      if (!deviceId) {
        return res.status(400).json({ error: "Device ID is required" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid amount is required" });
      }

      console.log("[Square Terminal] Creating terminal checkout...", {
        deviceId,
        amount,
        referenceId
      });

      // Generate unique idempotency key
      const idempotencyKey = randomBytes(32).toString("hex");

      const checkoutData = {
        idempotency_key: idempotencyKey,
        checkout: {
          amount_money: {
            amount: Math.round(amount * 100), // Convert to cents
            currency: "USD"
          },
          device_options: {
            device_id: deviceId,
            skip_receipt_screen: false,
            tip_settings: {
              allow_tipping: true
            }
          },
          reference_id: referenceId,
          note: note
        }
      };

      console.log("[Square Terminal] Request data:", JSON.stringify(checkoutData, null, 2));

      const response = await fetch(
        "https://connect.squareup.com/v2/terminals/checkouts",
        {
          method: "POST",
          headers: {
            "Square-Version": "2024-09-19",
            "Authorization": `Bearer ${token.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(checkoutData)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("[Square Terminal] Error creating checkout:", data);
        return res.status(response.status).json({ 
          error: "Failed to create terminal checkout", 
          details: data 
        });
      }

      console.log("[Square Terminal] Checkout created:", data.checkout?.id, "Status:", data.checkout?.status);

      res.json(data);
    } catch (error) {
      console.error("[Square Terminal] Error:", error);
      res.status(500).json({ error: "Failed to create terminal checkout" });
    }
  });

  // Helper function to sync menu items from Square catalog
  async function syncMenuFromSquare(accessToken: string): Promise<{ success: boolean; itemCount: number; error?: string }> {
    try {
      console.log("[Square Sync] Starting menu sync from Square catalog...");

      // Fetch catalog from Square
      const response = await fetch(
        "https://connect.squareup.com/v2/catalog/list?types=ITEM,CATEGORY",
        {
          method: "GET",
          headers: {
            "Square-Version": "2024-09-19",
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Square Sync] Failed to fetch catalog:", errorData);
        return { success: false, itemCount: 0, error: "Failed to fetch Square catalog" };
      }

      const data = await response.json();
      const objects = data.objects || [];

      // Build category map
      const categoryMap: { [id: string]: string } = {};
      objects.forEach((obj: any) => {
        if (obj.type === "CATEGORY") {
          categoryMap[obj.id] = obj.category_data?.name || "Other";
        }
      });

      // Extract items
      const items = objects.filter((obj: any) => obj.type === "ITEM");
      console.log(`[Square Sync] Found ${items.length} items in Square catalog`);

      // Clear existing menu items
      await storage.clearAllMenuItems();
      console.log("[Square Sync] Cleared existing menu items");

      // Import items from Square
      let importedCount = 0;
      for (const item of items) {
        const itemData = item.item_data;
        if (!itemData) continue;

        // Get first variation for price
        const variation = itemData.variations?.[0];
        const priceMoney = variation?.item_variation_data?.price_money;
        const priceInCents = priceMoney?.amount || 0;
        const priceInDollars = (priceInCents / 100).toFixed(2);

        // Get category name
        const categoryId = itemData.category_id;
        const categoryName = categoryId ? categoryMap[categoryId] || "Other" : "Other";

        await storage.createMenuItem({
          name: itemData.name || "Unnamed Item",
          price: priceInDollars,
          category: categoryName,
        });
        importedCount++;
      }

      console.log(`[Square Sync] Successfully imported ${importedCount} menu items`);
      return { success: true, itemCount: importedCount };
    } catch (error) {
      console.error("[Square Sync] Error:", error);
      return { success: false, itemCount: 0, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // GET /api/square/catalog/items - Fetch menu items from Square
  app.get("/api/square/catalog/items", async (req, res) => {
    try {
      const token = await storage.getSquareToken();
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      console.log("[Square Catalog] Fetching items...");

      const response = await fetch(
        "https://connect.squareup.com/v2/catalog/list?types=ITEM,CATEGORY",
        {
          method: "GET",
          headers: {
            "Square-Version": "2024-09-19",
            "Authorization": `Bearer ${token.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Square Catalog] Error response:", errorData);
        return res.status(response.status).json({ error: "Failed to fetch Square catalog", details: errorData });
      }

      const data = await response.json();
      
      // Filter to only include ITEM and CATEGORY types
      if (data.objects) {
        data.objects = data.objects.filter((obj: any) => 
          obj.type === "ITEM" || obj.type === "CATEGORY"
        );
      }
      
      console.log(`[Square Catalog] Fetched ${data.objects?.length || 0} items and categories`);

      res.json(data);
    } catch (error) {
      console.error("[Square Catalog] Error:", error);
      res.status(500).json({ error: "Failed to fetch Square catalog items" });
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
