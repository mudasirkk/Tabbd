import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMenuItemSchema } from "@shared/schema";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAuth, getStoreId } from "./middleware/auth";

const SQUARE_API_BASE =
  process.env.SQUARE_ENVIRONMENT === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

const SQUARE_OAUTH_BASE =
  `${SQUARE_API_BASE}/oauth2/authorize`;

async function fetchSquareBusinessName(accessToken: string): Promise<string> {
    const response = await fetch(
      `${SQUARE_API_BASE}/v2/locations`,
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
      throw new Error("Failed to fetch Square locations");
    }
  
    const data = await response.json();
  
    const primaryLocation = data.locations?.[0];
  
    return (
      primaryLocation?.business_name ||
      primaryLocation?.name ||
      "Square Store"
    );
  }
  

export async function registerRoutes(app: Express): Promise<Server> {
  if (
    !process.env.SQUARE_APPLICATION_ID ||
    !process.env.SQUARE_APPLICATION_SECRET ||
    !process.env.SQUARE_REDIRECT_URL
  ) {
    throw new Error("Missing Square OAuth environment variables");
  }

  // Generate OAuth state for CSRF protection
  app.get("/api/square/oauth/start", async (req, res) => {
    const csrf = randomBytes(32).toString("hex");
    await storage.saveSquareOAuthState(csrf);

    res.json({
      state: csrf,
      baseURL: SQUARE_OAUTH_BASE,
      appId: process.env.SQUARE_APPLICATION_ID,
      redirectUri: process.env.SQUARE_REDIRECT_URL,
    });
  });
  

  // Square OAuth callback
  app.get("/api/square/oauth/callback", async (req, res) => {
    const { code, state } = req.query;
  
    if (!code || !state || typeof state !== "string") {
      return res.status(400).send("Invalid OAuth response");
    }
    
    const isValid = await storage.verifySquareOAuthState(state);  
    if (!isValid) {
      return res.status(400).send("Invalid CSRF");
    }

    await storage.deleteSquareOAuthState(state);

    const tokenResponse = await fetch(`${SQUARE_API_BASE}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SQUARE_APPLICATION_ID,
          client_secret: process.env.SQUARE_APPLICATION_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: process.env.SQUARE_REDIRECT_URL,
        }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token || !tokenData.merchant_id) {
      return res.status(500).send("Invalid token response");
    }


    const merchantId = tokenData.merchant_id;

    let businessName = "Square Store";

    try {
      businessName = await fetchSquareBusinessName(tokenData.access_token);
    } catch (err) {
      console.warn("[Square] Failed to fetch business name:", err);
    }

    await storage.upsertStore({
      id: merchantId,
      name: businessName,
    });


    // Save tokens
    await storage.saveSquareToken(merchantId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null,
      merchantId,
    });

    // fire-and-forget menu sync
    syncMenuFromSquare(tokenData.access_token, merchantId)
    .catch(err => {
      console.error("[Square Sync] Initial sync failed:", err);
    });
    
    req.session.storeId = merchantId;

    res.redirect("/dashboard");
  });
  

  
  // ============ PROTECTED ROUTES ============
  // Update all existing routes to use requireAuth and getStoreId
  
  // GET /api/auth/me
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const store = await storage.getStoreById(storeId);

      if (!store) {
        return res.status(404).json({ error: "Store not found" });
      }

      res.json({
        id: store.id,
        name: store.name,
      });
    } catch (err) {
      console.error("[AUTH ME] Error:", err);
      res.status(500).json({ error: "Failed to fetch store" });
    }
  });


  app.post("/api/auth/disconnect", requireAuth, async (req, res) => {
    const storeId = getStoreId(req);
  
    const token = await storage.getSquareToken(storeId);
  
    if (token?.accessToken) {
      try {
        await fetch(`${SQUARE_API_BASE}/oauth2/revoke`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: process.env.SQUARE_APPLICATION_ID,
            access_token: token.accessToken,
          }),
        });
      } catch (err) {
        console.warn("[Square revoke] failed (continuing):", err);
      }
    }
  
    await storage.deleteSquareToken(storeId);
    await storage.clearAllMenuItems(storeId);
  
    req.session.destroy(() => {
      res.sendStatus(204);
    });
  });
  

  // GET /api/square/status
  app.get("/api/square/status", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const token = await storage.getSquareToken(storeId);
      res.json({
        connected: !!token,
        merchantId: token?.merchantId || null,
      });
    } catch (error) {
      console.error("Error checking Square status:", error);
      res.status(500).json({ error: "Failed to check Square status" });
    }
  });
 

  // GET /api/square/locations
  app.get("/api/square/locations", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const token = await storage.getSquareToken(storeId);
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      console.log("[Square Locations] Fetching locations...");

      const response = await fetch(
        `${SQUARE_API_BASE}/v2/locations`,
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

  // GET /api/square/devices
  app.get("/api/square/devices", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const token = await storage.getSquareToken(storeId);
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      console.log("[Square Devices] Fetching devices...");

      const response = await fetch(
        `${SQUARE_API_BASE}/v2/devices/codes`,
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

  // POST /api/square/terminals/checkouts
  app.post("/api/square/terminals/checkouts", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const token = await storage.getSquareToken(storeId);
      
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
        `${SQUARE_API_BASE}/v2/terminals/checkouts`,
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
  async function syncMenuFromSquare(accessToken: string, storeId: string): Promise<{ success: boolean; itemCount: number; error?: string }> {
    try {
      console.log("[Square Sync] Starting menu sync from Square catalog...");

      // Fetch catalog from Square
      const response = await fetch(
        `${SQUARE_API_BASE}/v2/catalog/list?types=ITEM,CATEGORY`,
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
      await storage.clearAllMenuItems(storeId);
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
          storeId,
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

  // GET /api/square/catalog/items
  app.get("/api/square/catalog/items", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const token = await storage.getSquareToken(storeId);
      
      if (!token) {
        return res.status(401).json({ error: "Square not connected" });
      }

      console.log("[Square Catalog] Fetching items...");

      const response = await fetch(
        `${SQUARE_API_BASE}/v2/catalog/list?types=ITEM,CATEGORY`,
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

  // GET /api/menu-items
  app.get("/api/menu-items", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const items = await storage.getAllMenuItems(storeId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      res.status(500).json({ error: "Failed to fetch menu items" });
    }
  });

  // POST /api/menu-items
  app.post("/api/menu-items", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      const validatedData = insertMenuItemSchema.parse(req.body);
      const item = await storage.createMenuItem({ ...validatedData, storeId });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating menu item:", error);
      res.status(400).json({ error: "Invalid menu item data" });
    }
  });

  // PATCH /api/menu-items/:id
  app.patch("/api/menu-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const storeId = getStoreId(req);
      const validatedData = insertMenuItemSchema.parse(req.body);
      const item = await storage.updateMenuItem(id, storeId, validatedData);
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

  // DELETE /api/menu-items/:id
  app.delete("/api/menu-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const storeId = getStoreId(req);
      const deleted = await storage.deleteMenuItem(id, storeId);
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
  app.delete("/api/menu-items", requireAuth, async (req, res) => {
    try {
      const storeId = getStoreId(req);
      await storage.clearAllMenuItems(storeId);
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing menu items:", error);
      res.status(500).json({ error: "Failed to clear menu items" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
