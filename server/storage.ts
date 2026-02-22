import {
  menuItems,
  sessions,
  stations,
  users,
  type MenuItem,
  type Station,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export class DatabaseStorage {
  // ---- Users ----
  async upsertUser(params: { id: string; email?: string | null}) : Promise<User> {
    const[row] = await db
      .insert(users)
      .values({
        id: params.id,
        email: params.email ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {email: params.email ?? null, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const[row] = await db.select().from(users).where(eq(users.id,userId)).limit(1);
    return row || undefined
  }

  async updateProfile(userId: string, storeName: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({storeName, updatedAt: new Date()})
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  // ---- Menu ----
  async listMenu(userId: string): Promise<MenuItem[]> {
    return db.select().from(menuItems).where(eq(menuItems.userId, userId)).orderBy(desc(menuItems.updatedAt));
  }
  
  async createMenuItem(userId: string, data: any): Promise<MenuItem> {
    const [row] = await db
      .insert(menuItems)
      .values({
        userId,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? 'Miscellaneous',
        price: data.price,
        stockQty: data.stockQty ?? 0,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  async updateMenuItem(userId: string, id: string, patch: Partial<MenuItem>): Promise<MenuItem | undefined> {
    const[row] = await db
      .update(menuItems)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(menuItems.userId, userId), eq(menuItems.id, id)))
      .returning();
    return row || undefined;
  }

  async deleteMenuItem(userId: string, id: string): Promise<boolean> {
    const rows = await db.delete(menuItems).where(and(eq(menuItems.userId, userId), eq( menuItems.id, id))).returning();
    return rows.length > 0;
  }

  // ---- Stations ----
  async listStations(userId: string): Promise<Station[]> {
    return db.select().from(stations).where(eq(stations.userId, userId)).orderBy(desc(stations.updatedAt));
  }

  async createStation(userId: string, data: any): Promise<Station> {
    const[row] = await db
      .insert(stations)
      .values({ userId, ...data, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return row;
  }

  async updateStation(userId: string, id: string, patch: Partial<Station>): Promise<Station | undefined> {
    const[row] = await db
      .update(stations)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(stations.userId, userId), eq(stations.id, id)))
      .returning();
    return row || undefined;
  }

  //Update Station
  async deleteStation(userId: string, id: string): Promise<boolean> {
    // Block delete if there is any non-closed session for this station
    const active = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.stationId, id),
          sql`${sessions.status} != 'closed'`
        )
      )
      .limit(1);

    if (active.length > 0) {
      throw new Error("Cannot delete station with an active session");
    }

    const rows = await db
      .delete(stations)
      .where(and(eq(stations.userId, userId), eq(stations.id, id)))
      .returning();

    return rows.length > 0;
  }

}

export const storage = new DatabaseStorage();
