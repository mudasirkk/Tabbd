import { z } from "zod";
import { cloverSyncApplySchema, cloverPushSchema } from "@shared/schema";
import type { MenuItem } from "@shared/schema";
import { cloverStorage } from "./storage";
import { menuStorage } from "../menu/storage";
import { settingsStorage } from "../settings/storage";
import { createCloverApi } from "./api";
import {
  CloverNotConnectedError,
  CloverAuthError,
  CloverSyncValidationError,
} from "./errors";
import type { CloverItem, CloverCategory, CloverTokenResponse } from "./types";

interface StateEntry {
  userId: string;
  expiresAt: number;
}

export interface FieldDiff {
  field: string;
  tabbdValue: unknown;
  cloverValue: unknown;
}

export interface SyncPreviewItem {
  cloverItem: CloverItem;
  tabbdItemId?: string;
  diffs?: FieldDiff[];
}

export interface SyncPreviewResult {
  newItems: CloverItem[];
  changedItems: SyncPreviewItem[];
  deletedItems: MenuItem[];
  unchangedItems: SyncPreviewItem[];
}

type SyncApplyBody = z.infer<typeof cloverSyncApplySchema>;
type PushBody = z.infer<typeof cloverPushSchema>;

export interface PushResult {
  pushed: number;
  created: number;
  updated: number;
  errors: Array<{ itemId: string; message: string }>;
}

function generateStateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

function decimalToCents(value: string | number): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Math.round(n * 100);
}

function mapCloverItemToFields(item: CloverItem): {
  name: string;
  price: string;
  description: string | null;
  sku: string | null;
  category: string;
  cloverCategoryId: string | null;
  cloverItemId: string;
} {
  const firstCategory = item.categories?.elements?.[0] ?? null;
  return {
    name: item.name,
    price: centsToDecimal(item.price),
    description: item.alternateName ?? null,
    sku: item.sku ?? null,
    category: firstCategory?.name ?? "Miscellaneous",
    cloverCategoryId: firstCategory?.id ?? null,
    cloverItemId: item.id,
  };
}

class CloverService {
  private stateMap: Map<string, StateEntry> = new Map();
  private readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  private cleanExpiredStates(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.stateMap.forEach((entry, token) => {
      if (entry.expiresAt <= now) {
        keysToDelete.push(token);
      }
    });
    for (const key of keysToDelete) {
      this.stateMap.delete(key);
    }
  }

  generateAuthUrl(userId: string): string {
    this.cleanExpiredStates();

    const state = generateStateToken();
    this.stateMap.set(state, {
      userId,
      expiresAt: Date.now() + this.STATE_TTL_MS,
    });

    const cloverBaseUrl =
      process.env.CLOVER_BASE_URL ?? "https://sandbox.dev.clover.com";
    const appId = process.env.CLOVER_APP_ID ?? "";
    const appBaseUrl = process.env.APP_BASE_URL ?? "";
    const redirectUri = encodeURIComponent(
      process.env.CLOVER_REDIRECT_URI ?? `${appBaseUrl}/api/clover/callback`
    );

    return `${cloverBaseUrl}/oauth/v2/authorize?client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;
  }

  async handleCallback(
    code: string,
    state: string,
    merchantId: string
  ): Promise<string> {
    this.cleanExpiredStates();

    const entry = this.stateMap.get(state);
    if (!entry || entry.expiresAt <= Date.now()) {
      throw new CloverAuthError("Invalid or expired OAuth state token");
    }

    const userId = entry.userId;
    this.stateMap.delete(state);

    const cloverApiBaseUrl =
      process.env.CLOVER_API_BASE_URL ?? "https://apisandbox.dev.clover.com";
    const appId = process.env.CLOVER_APP_ID ?? "";
    const appSecret = process.env.CLOVER_APP_SECRET ?? "";

    const tokenUrl = `${cloverApiBaseUrl}/oauth/v2/token`;
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new CloverAuthError(
        `Failed to exchange code for token: ${res.status} ${text.slice(0, 200)}`
      );
    }

    const data = (await res.json()) as CloverTokenResponse;
    const accessToken = data.access_token;
    if (!accessToken) {
      throw new CloverAuthError("No access_token in Clover token response");
    }

    await settingsStorage.updateCloverCredentials(userId, {
      merchantId,
      accessToken,
    });

    return userId;
  }

  async disconnect(userId: string): Promise<void> {
    await settingsStorage.clearCloverCredentials(userId);
  }

  async syncPreview(userId: string): Promise<SyncPreviewResult> {
    const creds = await cloverStorage.getUserCloverCredentials(userId);
    if (!creds) {
      throw new CloverNotConnectedError(
        "Clover is not connected. Please connect via OAuth first."
      );
    }

    const api = createCloverApi(creds.accessToken, creds.merchantId);
    const [cloverItems, tabbdItems] = await Promise.all([
      api.fetchAllItems(),
      menuStorage.listMenu(userId),
    ]);

    // Build lookup maps for Tabbd items
    const tabbdByCloverItemId = new Map<string, MenuItem>();
    const tabbdBySku = new Map<string, MenuItem>();
    const tabbdByNameLower = new Map<string, MenuItem>();

    for (const item of tabbdItems) {
      if (item.cloverItemId) {
        tabbdByCloverItemId.set(item.cloverItemId, item);
      }
      if (item.sku) {
        tabbdBySku.set(item.sku, item);
      }
      tabbdByNameLower.set(item.name.toLowerCase(), item);
    }

    const matchedTabbdIds = new Set<string>();

    const newItems: CloverItem[] = [];
    const changedItems: SyncPreviewItem[] = [];
    const unchangedItems: SyncPreviewItem[] = [];

    for (const cloverItem of cloverItems) {
      const mapped = mapCloverItemToFields(cloverItem);

      // Match by cloverItemId, then sku, then name
      let tabbdItem: MenuItem | undefined;
      tabbdItem = tabbdByCloverItemId.get(cloverItem.id);
      if (!tabbdItem && mapped.sku) {
        tabbdItem = tabbdBySku.get(mapped.sku);
      }
      if (!tabbdItem) {
        tabbdItem = tabbdByNameLower.get(mapped.name.toLowerCase());
      }

      if (!tabbdItem) {
        newItems.push(cloverItem);
        continue;
      }

      matchedTabbdIds.add(tabbdItem.id);

      // Compute field diffs
      const diffs: FieldDiff[] = [];

      if (tabbdItem.name !== mapped.name) {
        diffs.push({ field: "name", tabbdValue: tabbdItem.name, cloverValue: mapped.name });
      }

      const tabbdPriceCents = decimalToCents(tabbdItem.price);
      const cloverPriceCents = cloverItem.price;
      if (tabbdPriceCents !== cloverPriceCents) {
        diffs.push({
          field: "price",
          tabbdValue: tabbdItem.price,
          cloverValue: mapped.price,
        });
      }

      const tabbdDesc = tabbdItem.description ?? null;
      const cloverDesc = mapped.description;
      if (tabbdDesc !== cloverDesc) {
        diffs.push({
          field: "description",
          tabbdValue: tabbdDesc,
          cloverValue: cloverDesc,
        });
      }

      const tabbdSku = tabbdItem.sku ?? null;
      const cloverSku = mapped.sku;
      if (tabbdSku !== cloverSku) {
        diffs.push({ field: "sku", tabbdValue: tabbdSku, cloverValue: cloverSku });
      }

      const tabbdCategory = tabbdItem.category ?? "Miscellaneous";
      const cloverCategory = mapped.category;
      if (tabbdCategory !== cloverCategory) {
        diffs.push({
          field: "category",
          tabbdValue: tabbdCategory,
          cloverValue: cloverCategory,
        });
      }

      if (diffs.length > 0) {
        changedItems.push({ cloverItem, tabbdItemId: tabbdItem.id, diffs });
      } else {
        unchangedItems.push({ cloverItem, tabbdItemId: tabbdItem.id });
      }
    }

    // Items in Tabbd not matched by any Clover item — they would be deleted in replace mode
    const deletedItems = tabbdItems.filter(
      (item) => !matchedTabbdIds.has(item.id)
    );

    return { newItems, changedItems, deletedItems, unchangedItems };
  }

  async syncApply(
    userId: string,
    body: unknown
  ): Promise<{ applied: number; deleted: number }> {
    const parsed = cloverSyncApplySchema.safeParse(body);
    if (!parsed.success) {
      throw new CloverSyncValidationError(
        `Invalid sync apply body: ${parsed.error.message}`
      );
    }

    const creds = await cloverStorage.getUserCloverCredentials(userId);
    if (!creds) {
      throw new CloverNotConnectedError(
        "Clover is not connected. Please connect via OAuth first."
      );
    }

    const { mode, selectedItemIds, confirmedDeletes, conflictResolutions } =
      parsed.data;

    const api = createCloverApi(creds.accessToken, creds.merchantId);
    const [cloverItems, tabbdItems] = await Promise.all([
      api.fetchAllItems(),
      menuStorage.listMenu(userId),
    ]);

    const tabbdByCloverItemId = new Map<string, MenuItem>();
    const tabbdBySku = new Map<string, MenuItem>();
    const tabbdByNameLower = new Map<string, MenuItem>();

    for (const item of tabbdItems) {
      if (item.cloverItemId) tabbdByCloverItemId.set(item.cloverItemId, item);
      if (item.sku) tabbdBySku.set(item.sku, item);
      tabbdByNameLower.set(item.name.toLowerCase(), item);
    }

    const resolutionMap = new Map<
      string,
      "keep_tabbd" | "use_clover"
    >();
    if (conflictResolutions) {
      for (const r of conflictResolutions) {
        resolutionMap.set(r.tabbdItemId, r.action);
      }
    }

    if (mode === "replace") {
      // Delete all existing items and insert selected Clover items
      const itemsToInsert = selectedItemIds
        ? cloverItems.filter((ci) => selectedItemIds.includes(ci.id))
        : cloverItems;

      await cloverStorage.deleteAllMenuItems(userId);

      const upsertData = itemsToInsert.map((ci) => {
        const mapped = mapCloverItemToFields(ci);
        return {
          name: mapped.name,
          description: mapped.description,
          category: mapped.category,
          price: mapped.price,
          stockQty: ci.stockCount ?? 0,
          isActive: true,
          isVariablePrice: false,
          sku: mapped.sku,
          cloverItemId: mapped.cloverItemId,
          cloverCategoryId: mapped.cloverCategoryId,
        };
      });

      await cloverStorage.batchUpsertMenuItems(userId, upsertData);
      return { applied: upsertData.length, deleted: tabbdItems.length };
    }

    // Merge mode
    let applied = 0;
    let deleted = 0;

    const matchedTabbdIds = new Set<string>();

    const toInsert: typeof cloverItems = [];
    const toUpdate: Array<{
      tabbdItem: MenuItem;
      cloverItem: CloverItem;
    }> = [];

    for (const cloverItem of cloverItems) {
      const mapped = mapCloverItemToFields(cloverItem);

      let tabbdItem: MenuItem | undefined;
      tabbdItem = tabbdByCloverItemId.get(cloverItem.id);
      if (!tabbdItem && mapped.sku) tabbdItem = tabbdBySku.get(mapped.sku);
      if (!tabbdItem) tabbdItem = tabbdByNameLower.get(mapped.name.toLowerCase());

      if (!tabbdItem) {
        toInsert.push(cloverItem);
      } else {
        matchedTabbdIds.add(tabbdItem.id);
        const resolution = resolutionMap.get(tabbdItem.id);
        if (resolution === "use_clover") {
          toUpdate.push({ tabbdItem, cloverItem });
        }
        // keep_tabbd or no resolution: leave unchanged
      }
    }

    // Insert new items
    const insertData = toInsert.map((ci) => {
      const mapped = mapCloverItemToFields(ci);
      return {
        name: mapped.name,
        description: mapped.description,
        category: mapped.category,
        price: mapped.price,
        stockQty: ci.stockCount ?? 0,
        isActive: true,
        isVariablePrice: false,
        sku: mapped.sku,
        cloverItemId: mapped.cloverItemId,
        cloverCategoryId: mapped.cloverCategoryId,
      };
    });

    if (insertData.length > 0) {
      await cloverStorage.batchUpsertMenuItems(userId, insertData);
      applied += insertData.length;
    }

    // Update items with use_clover resolution
    for (const { tabbdItem, cloverItem } of toUpdate) {
      const mapped = mapCloverItemToFields(cloverItem);
      await menuStorage.updateMenuItem(userId, tabbdItem.id, {
        name: mapped.name,
        description: mapped.description,
        category: mapped.category,
        price: mapped.price,
        sku: mapped.sku,
        cloverItemId: mapped.cloverItemId,
        cloverCategoryId: mapped.cloverCategoryId,
      } as any);
      applied++;
    }

    // Delete confirmed items
    if (confirmedDeletes && confirmedDeletes.length > 0) {
      await cloverStorage.batchDeleteMenuItems(userId, confirmedDeletes);
      deleted = confirmedDeletes.length;
    }

    return { applied, deleted };
  }

  async push(userId: string, body: unknown): Promise<PushResult> {
    const parsed = cloverPushSchema.safeParse(body);
    if (!parsed.success) {
      throw new CloverSyncValidationError(
        `Invalid push body: ${parsed.error.message}`
      );
    }

    const creds = await cloverStorage.getUserCloverCredentials(userId);
    if (!creds) {
      throw new CloverNotConnectedError(
        "Clover is not connected. Please connect via OAuth first."
      );
    }

    const { itemIds } = parsed.data;

    let tabbdItems = await menuStorage.listMenu(userId);
    if (itemIds && itemIds.length > 0) {
      tabbdItems = tabbdItems.filter((item) => itemIds.includes(item.id));
    }

    const api = createCloverApi(creds.accessToken, creds.merchantId);

    // Build category map: name → clover category id
    const cloverCategories = await api.fetchCategories();
    const categoryMap = new Map<string, string>();
    for (const cat of cloverCategories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    }

    const result: PushResult = {
      pushed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    const syncedIds: string[] = [];

    for (const item of tabbdItems) {
      try {
        const category = item.category ?? "Miscellaneous";
        let cloverCategoryId: string | null = null;

        if (category && category !== "Miscellaneous") {
          const existingCatId = categoryMap.get(category.toLowerCase());
          if (existingCatId) {
            cloverCategoryId = existingCatId;
          } else {
            // Create category on Clover
            const newCat = await api.createCategory(category);
            categoryMap.set(category.toLowerCase(), newCat.id);
            cloverCategoryId = newCat.id;
          }
        }

        const priceCents = decimalToCents(item.price);

        if (item.cloverItemId) {
          // Update existing Clover item
          await api.updateItem(item.cloverItemId, {
            name: item.name,
            price: priceCents,
            alternateName: item.description ?? null,
            sku: item.sku ?? null,
          });

          if (cloverCategoryId) {
            await api.associateItemCategory(item.cloverItemId, cloverCategoryId);
          }

          result.updated++;
        } else {
          // Create new Clover item
          const created = await api.createItem({
            name: item.name,
            price: priceCents,
            alternateName: item.description ?? null,
            sku: item.sku ?? null,
          });

          if (cloverCategoryId) {
            await api.associateItemCategory(created.id, cloverCategoryId);
          }

          await cloverStorage.setCloverItemId(item.id, created.id);
          result.created++;
        }

        // Sync stock
        if (item.stockQty != null && item.stockQty > 0) {
          const cloverItemId = item.cloverItemId ?? "";
          if (cloverItemId) {
            await api.updateItemStock(cloverItemId, item.stockQty);
          }
        }

        syncedIds.push(item.id);
        result.pushed++;
      } catch (err: any) {
        result.errors.push({
          itemId: item.id,
          message: err?.message ?? "Unknown error",
        });
      }
    }

    if (syncedIds.length > 0) {
      await cloverStorage.updateLastSyncedAt(userId, syncedIds);
    }

    return result;
  }
}

export const cloverService = new CloverService();
