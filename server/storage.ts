import { 
  type Store, 
  type InsertStore, 
  type MenuItem, 
  type InsertMenuItem, 
  type SquareToken, 
  type InsertSquareToken, 
  type OAuthState, 
  type InsertOAuthState 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Store CRUD
  getStoreById(id: string): Promise<Store | undefined>;
  getStoreByEmail(email: string): Promise<Store | undefined>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: string, store: Partial<InsertStore>): Promise<Store | undefined>;
  
  // Menu items CRUD (store-scoped)
  getAllMenuItems(storeId: string): Promise<MenuItem[]>;
  getMenuItem(id: string, storeId: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, storeId: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: string, storeId: string): Promise<boolean>;
  clearAllMenuItems(storeId: string): Promise<void>;
  seedMenuItems(storeId: string): Promise<void>;
  
  // Square tokens (store-scoped)
  saveSquareToken(storeId: string, token: InsertSquareToken): Promise<SquareToken>;
  getSquareToken(storeId: string): Promise<SquareToken | undefined>;
  deleteSquareToken(storeId: string): Promise<void>;
  
  // OAuth states (for Square OAuth)
  saveOAuthState(state: InsertOAuthState): Promise<OAuthState>;
  getOAuthState(state: string): Promise<OAuthState | undefined>;
  deleteOAuthState(state: string): Promise<void>;
  cleanupExpiredStates(): Promise<void>;
}

import { stores, menuItems, squareTokens, oauthStates } from "@shared/schema";
import { db } from "./db";
import { eq, and, count, lt } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // Store methods
  async getStoreById(id: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async getStoreByEmail(email: string): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.email, email));
    return store || undefined;
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [created] = await db
      .insert(stores)
      .values(store)
      .returning();
    return created;
  }

  async updateStore(id: string, store: Partial<InsertStore>): Promise<Store | undefined> {
    const [updated] = await db
      .update(stores)
      .set({ ...store, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return updated || undefined;
  }

  // Menu items (store-scoped)
  async getAllMenuItems(storeId: string): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.storeId, storeId));
  }

  async getMenuItem(id: string, storeId: string): Promise<MenuItem | undefined> {
    const [item] = await db.select()
      .from(menuItems)
      .where(and(eq(menuItems.id, id), eq(menuItems.storeId, storeId)));
    return item || undefined;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [created] = await db
      .insert(menuItems)
      .values(item)
      .returning();
    return created;
  }

  async updateMenuItem(id: string, storeId: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [updated] = await db
      .update(menuItems)
      .set(item)
      .where(and(eq(menuItems.id, id), eq(menuItems.storeId, storeId)))
      .returning();
    return updated || undefined;
  }

  async deleteMenuItem(id: string, storeId: string): Promise<boolean> {
    // Note: This should also check storeId for security - consider updating signature
    const result = await db
      .delete(menuItems)
      .where(eq(menuItems.id, id))
      .returning();
    return result.length > 0;
  }

  async clearAllMenuItems(storeId: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.storeId, storeId));
  }

  async seedMenuItems(storeId: string): Promise<void> {
    const [result] = await db.select({ count: count() })
      .from(menuItems)
      .where(eq(menuItems.storeId, storeId));
    
    if (result.count > 0) {
      return;
    }

    const defaultMenuItems: InsertMenuItem[] = [
      { storeId, name: "TABLE (POOL/FOOSBALL)", price: "16.00", category: "Gaming" },
      { storeId, name: "SOLO", price: "10.00", category: "Gaming" },
      { storeId, name: "GAMING", price: "16.00", category: "Gaming" },
      { storeId, name: "Vanilla Latte", price: "4.99", category: "Lattes" },
      { storeId, name: "Caramel Latte", price: "4.99", category: "Lattes" },
      { storeId, name: "Brown Sugar Latte", price: "4.99", category: "Lattes" },
      { storeId, name: "Biscoff Latte", price: "4.99", category: "Lattes" },
      { storeId, name: "Pistachio Latte", price: "4.99", category: "Lattes" },
      { storeId, name: "Adeni Tea", price: "4.49", category: "Tea" },
      { storeId, name: "Berry Hibiscus Refresher", price: "4.49", category: "Refreshers" },
      { storeId, name: "Mango Dragon Fruit Refresher", price: "4.49", category: "Refreshers" },
      { storeId, name: "Strawberry Acai Refresher", price: "4.49", category: "Refreshers" },
      { storeId, name: "Pomegranate Refresher", price: "4.49", category: "Refreshers" },
      { storeId, name: "Blue Citrus Refresher", price: "4.49", category: "Refreshers" },
      { storeId, name: "Slushies", price: "2.99", category: "Slushies" },
      { storeId, name: "Cookies", price: "1.99", category: "Dessert" },
      { storeId, name: "Milk Cake", price: "5.99", category: "Dessert" },
      { storeId, name: "Banana Pudding", price: "4.49", category: "Dessert" },
    ];

    for (const item of defaultMenuItems) {
      await this.createMenuItem(item);
    }
  }

  // Square tokens (store-scoped)
  async saveSquareToken(storeId: string, token: InsertSquareToken): Promise<SquareToken> {
    await db.delete(squareTokens).where(eq(squareTokens.storeId, storeId));
    
    const [created] = await db
      .insert(squareTokens)
      .values({ ...token, storeId })
      .returning();
    return created;
  }

  async getSquareToken(storeId: string): Promise<SquareToken | undefined> {
    const [token] = await db.select()
      .from(squareTokens)
      .where(eq(squareTokens.storeId, storeId))
      .limit(1);
    return token || undefined;
  }

  async deleteSquareToken(storeId: string): Promise<void> {
    await db.delete(squareTokens).where(eq(squareTokens.storeId, storeId));
  }

  // OAuth states
  async saveOAuthState(state: InsertOAuthState): Promise<OAuthState> {
    const [created] = await db
      .insert(oauthStates)
      .values(state)
      .returning();
    return created;
  }

  async getOAuthState(state: string): Promise<OAuthState | undefined> {
    const [result] = await db.select().from(oauthStates).where(eq(oauthStates.state, state));
    return result || undefined;
  }

  async deleteOAuthState(state: string): Promise<void> {
    await db.delete(oauthStates).where(eq(oauthStates.state, state));
  }

  async cleanupExpiredStates(): Promise<void> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await db.delete(oauthStates).where(lt(oauthStates.createdAt, fiveMinutesAgo));
  }
}

export const storage = new DatabaseStorage();
