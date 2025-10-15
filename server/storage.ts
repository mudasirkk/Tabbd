import { type User, type InsertUser, type MenuItem, type InsertMenuItem } from "@shared/schema";
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
  seedMenuItems(): Promise<void>;
}

// Reference: blueprint:javascript_database
import { users, menuItems } from "@shared/schema";
import { db } from "./db";
import { eq, count } from "drizzle-orm";

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

  async seedMenuItems(): Promise<void> {
    const [result] = await db.select({ count: count() }).from(menuItems);
    
    if (result.count > 0) {
      return;
    }

    const defaultMenuItems: InsertMenuItem[] = [
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
}

export const storage = new DatabaseStorage();
