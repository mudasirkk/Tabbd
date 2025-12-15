import { 
  type Store, 
  type InsertStore, 
  type MenuItem, 
  type InsertMenuItem, 
  type SquareToken, 
  type InsertSquareToken,
} from "@shared/schema";

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
  
  // Square tokens (store-scoped)
  saveSquareToken(storeId: string, token: InsertSquareToken): Promise<SquareToken>;
  getSquareToken(storeId: string): Promise<SquareToken | undefined>;
  deleteSquareToken(storeId: string): Promise<void>;
  
  // OAuth states (for Square OAuth)
  saveSquareOAuthState(storeId: string, csrf: string): Promise<void>;
  verifySquareOAuthState(storeId: string, csrf: string): Promise<boolean>;
  deleteSquareOAuthState(storeId: string): Promise<void>;
  cleanupExpiredSquareOAuthStates(): Promise<void>;
}

import { stores, menuItems, squareTokens, oauthStates } from "@shared/schema";
import { db } from "./db";
import { eq, and, lt } from "drizzle-orm";

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
      .where(and(eq(menuItems.id, id), eq(menuItems.storeId, storeId)))
      .returning();
    return result.length > 0;
  }

  async clearAllMenuItems(storeId: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.storeId, storeId));
  }

  async saveSquareOAuthState(storeId: string, csrf: string): Promise<void> {
    // Only one active OAuth attempt per store
    await db.delete(oauthStates).where(eq(oauthStates.storeId, storeId));
  
    await db.insert(oauthStates).values({
      storeId,
      csrfToken: csrf,
      createdAt: new Date(),
    });
  }
  
  async verifySquareOAuthState(storeId: string, csrf: string): Promise<boolean> {
    const [state] = await db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.storeId, storeId))
      .limit(1);
  
    if (!state) return false;
  
    // ⏱ Expire after 10 minutes
    const expired =
      Date.now() - state.createdAt.getTime() > 10 * 60 * 1000;
  
    if (expired) {
      await this.deleteSquareOAuthState(storeId);
      return false;
    }
  
    return state.csrfToken === csrf;
  }

  async deleteSquareOAuthState(storeId: string): Promise<void> {
    await db.delete(oauthStates).where(eq(oauthStates.storeId, storeId));
  }

  async cleanupExpiredSquareOAuthStates(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await db.delete(oauthStates).where(lt(oauthStates.createdAt, tenMinutesAgo));
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
}

export const storage = new DatabaseStorage();
