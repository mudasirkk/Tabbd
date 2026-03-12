import { menuItems, users, type MenuItem } from "@shared/schema";
import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";

export interface CloverCredentials {
  merchantId: string;
  accessToken: string;
  connectedAt: Date;
}

export interface UpsertMenuItemData {
  name: string;
  description: string | null;
  category: string;
  price: string;
  stockQty: number;
  isActive: boolean;
  isVariablePrice: boolean;
  sku: string | null;
  cloverItemId: string;
  cloverCategoryId: string | null;
}

export class CloverStorage {
  async getUserCloverCredentials(
    userId: string
  ): Promise<CloverCredentials | null> {
    const [row] = await db
      .select({
        cloverMerchantId: users.cloverMerchantId,
        cloverAccessToken: users.cloverAccessToken,
        cloverConnectedAt: users.cloverConnectedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (
      !row ||
      !row.cloverMerchantId ||
      !row.cloverAccessToken ||
      !row.cloverConnectedAt
    ) {
      return null;
    }

    return {
      merchantId: row.cloverMerchantId,
      accessToken: row.cloverAccessToken,
      connectedAt: row.cloverConnectedAt,
    };
  }

  async batchUpsertMenuItems(
    userId: string,
    items: UpsertMenuItemData[]
  ): Promise<MenuItem[]> {
    if (items.length === 0) return [];

    return db.transaction(async (tx) => {
      const results: MenuItem[] = [];
      for (const item of items) {
        // Check if a matching item already exists by cloverItemId
        const [existing] = await tx
          .select()
          .from(menuItems)
          .where(
            and(
              eq(menuItems.userId, userId),
              eq(menuItems.cloverItemId, item.cloverItemId)
            )
          )
          .limit(1);

        if (existing) {
          const [updated] = await tx
            .update(menuItems)
            .set({
              name: item.name,
              description: item.description,
              category: item.category,
              price: item.price,
              stockQty: item.stockQty,
              isActive: item.isActive,
              isVariablePrice: item.isVariablePrice,
              sku: item.sku,
              cloverCategoryId: item.cloverCategoryId,
              updatedAt: new Date(),
            })
            .where(eq(menuItems.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          const [inserted] = await tx
            .insert(menuItems)
            .values({
              userId,
              name: item.name,
              description: item.description,
              category: item.category,
              price: item.price,
              stockQty: item.stockQty,
              isActive: item.isActive,
              isVariablePrice: item.isVariablePrice,
              sku: item.sku,
              cloverItemId: item.cloverItemId,
              cloverCategoryId: item.cloverCategoryId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          results.push(inserted);
        }
      }
      return results;
    });
  }

  async batchDeleteMenuItems(
    userId: string,
    itemIds: string[]
  ): Promise<void> {
    if (itemIds.length === 0) return;
    await db
      .delete(menuItems)
      .where(
        and(eq(menuItems.userId, userId), inArray(menuItems.id, itemIds))
      );
  }

  async deleteAllMenuItems(userId: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.userId, userId));
  }

  async updateLastSyncedAt(
    userId: string,
    menuItemIds: string[]
  ): Promise<void> {
    if (menuItemIds.length === 0) return;
    await db
      .update(menuItems)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(menuItems.userId, userId), inArray(menuItems.id, menuItemIds))
      );
  }

  async setCloverItemId(
    menuItemId: string,
    cloverItemId: string
  ): Promise<void> {
    await db
      .update(menuItems)
      .set({ cloverItemId, updatedAt: new Date() })
      .where(eq(menuItems.id, menuItemId));
  }
}

export const cloverStorage = new CloverStorage();
