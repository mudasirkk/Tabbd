import { type User, type InsertUser, type MenuItem, type InsertMenuItem, type SquareToken, type InsertSquareToken, type OAuthState, type InsertOAuthState } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Menu items CRUD
  getAllMenuItems(): Promise<MenuItem[]>;
  getMenuItem(id: string): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: string): Promise<boolean>;
  clearAllMenuItems(): Promise<void>;
  seedMenuItems(): Promise<void>;
  
  // Square tokens
  saveSquareToken(token: InsertSquareToken): Promise<SquareToken>;
  getSquareToken(): Promise<SquareToken | undefined>;
  deleteSquareToken(): Promise<void>;
  
  // OAuth states
  saveOAuthState(state: InsertOAuthState): Promise<OAuthState>;
  getOAuthState(state: string): Promise<OAuthState | undefined>;
  deleteOAuthState(state: string): Promise<void>;
  cleanupExpiredStates(): Promise<void>;
}

// Reference: blueprint:javascript_database
import { users, menuItems, squareTokens, oauthStates } from "@shared/schema";
import { db } from "./db";
import { eq, count, lt, sql as drizzleSql } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Menu items CRUD
  async getAllMenuItems(): Promise<MenuItem[]> {
    return await db.select().from(menuItems);
  }

  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return item || undefined;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [created] = await db
      .insert(menuItems)
      .values(item)
      .returning();
    return created;
  }

  async updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [updated] = await db
      .update(menuItems)
      .set(item)
      .where(eq(menuItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    const result = await db
      .delete(menuItems)
      .where(eq(menuItems.id, id))
      .returning();
    return result.length > 0;
  }

  async clearAllMenuItems(): Promise<void> {
    await db.delete(menuItems);
  }

  async seedMenuItems(): Promise<void> {
    const [result] = await db.select({ count: count() }).from(menuItems);
    
    if (result.count > 0) {
      return;
    }

    const defaultMenuItems: InsertMenuItem[] = [
      { name: "TABLE (POOL/FOOSBALL)", price: "16.00", category: "Gaming" },
      { name: "SOLO", price: "10.00", category: "Gaming" },
      { name: "GAMING", price: "16.00", category: "Gaming" },
      { name: "Vanilla Latte", price: "4.99", category: "Lattes" },
      { name: "Caramel Latte", price: "4.99", category: "Lattes" },
      { name: "Brown Sugar Latte", price: "4.99", category: "Lattes" },
      { name: "Biscoff Latte", price: "4.99", category: "Lattes" },
      { name: "Pistachio Latte", price: "4.99", category: "Lattes" },
      { name: "Adeni Tea", price: "4.49", category: "Tea" },
      { name: "Berry Hibiscus Refresher", price: "4.49", category: "Refreshers" },
      { name: "Mango Dragon Fruit Refresher", price: "4.49", category: "Refreshers" },
      { name: "Strawberry Acai Refresher", price: "4.49", category: "Refreshers" },
      { name: "Pomegranate Refresher", price: "4.49", category: "Refreshers" },
      { name: "Blue Citrus Refresher", price: "4.49", category: "Refreshers" },
      { name: "Slushies", price: "2.99", category: "Slushies" },
      { name: "Cookies", price: "1.99", category: "Dessert" },
      { name: "Milk Cake", price: "5.99", category: "Dessert" },
      { name: "Banana Pudding", price: "4.49", category: "Dessert" },
    ];

    for (const item of defaultMenuItems) {
      await this.createMenuItem(item);
    }
  }

  async saveSquareToken(token: InsertSquareToken): Promise<SquareToken> {
    await db.delete(squareTokens);
    
    const [created] = await db
      .insert(squareTokens)
      .values(token)
      .returning();
    return created;
  }

  async getSquareToken(): Promise<SquareToken | undefined> {
    const [token] = await db.select().from(squareTokens).limit(1);
    return token || undefined;
  }

  async deleteSquareToken(): Promise<void> {
    await db.delete(squareTokens);
  }

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
