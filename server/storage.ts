import {
  addSessionItemSchema,
  menuItems,
  sessions,
  sessionItems,
  stations,
  users,
  type MenuItem,
  type Session,
  type SessionItem,
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

  // ---- Sessions ----
  async getActiveSessionForStation(userId: string, stationId: string): Promise<Session | undefined> {
    const[row] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.stationId, stationId), sql`${sessions.status} != 'closed'`))
      .orderBy(desc(sessions.createdAt))
      .limit(1);
    return row || undefined;
  }

  async startSession(userId: string, stationId: string, startedAt: Date): Promise<Session> {
    const existing = await this.getActiveSessionForStation(userId, stationId);
    if(existing) return existing;

    const[row] = await db
      .insert(sessions)
      .values({ userId, stationId, status: "active", startedAt, createdAt: new Date() })
      .returning()
    return row;
  }

  async pauseSession(userId: string, sessionId: string): Promise<Session | undefined> {
    const[row] = await db
      .update(sessions)
      .set({ status:"paused", pausedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId), eq(sessions.status, "active")))
      .returning();
    return row || undefined;
  }

  async resumeSession(userId: string, sessionId: string): Promise<Session | undefined> {
    const [current] = await db.select().from(sessions).where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId))).limit(1);
    if(!current || current.status !== "paused" || !current.pausedAt) return undefined;

    const deltaSeconds = Math.max(0, Math.floor((Date.now() - current.pausedAt.getTime()) / 1000));
    const [row] = await db
      .update(sessions)
      .set({
        status: "active",
        pausedAt: null,
        totalPausedSeconds: (current.totalPausedSeconds ?? 0) + deltaSeconds,
        updatedAt: new Date(),
      })
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .returning();
    return row || undefined;
  }

  async closeSession(userId: string, sessionId: string, pricingTier?: "solo" | "group"): Promise<Session | undefined> {
    const [row] = await db
      .update(sessions)
      .set({ status: "closed", pricingTier: pricingTier ?? null, closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .returning();
    return row || undefined;
  }

  async listSessionItems(userId: string, sessionId: string): Promise<SessionItem[]> {
    const [sess] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId))).limit(1);
    if (!sess) return [];
    return db.select().from(sessionItems).where(eq(sessionItems.sessionId, sessionId)).orderBy(desc(sessionItems.createdAt));
  }

  //  Stockqty decrement transaction here
  async addItemToSession(userId: string, sessionId: string, input: unknown): Promise<{ sessionItem: SessionItem; menuItem: MenuItem }> {
    const { menuItemId, qty } = addSessionItemSchema.parse(input);

    return await db.transaction(async (tx) => {
      const [sess] = await tx.select().from(sessions).where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId))).limit(1);
      if (!sess) throw new Error("Session not found");
      if (sess.status === "closed") throw new Error("Session is closed");

      const [item] = await tx.select().from(menuItems).where(and(eq(menuItems.userId, userId), eq(menuItems.id, menuItemId))).limit(1);
      if (!item) throw new Error("Menu item not found");
      if (!item.isActive) throw new Error("Menu item is inactive");
      if ((item.stockQty ?? 0) < qty) throw new Error("Insufficient stock");

      const [updatedMenuItem] = await tx
        .update(menuItems)
        .set({ stockQty: (item.stockQty ?? 0) - qty, updatedAt: new Date() })
        .where(and(eq(menuItems.userId, userId), eq(menuItems.id, menuItemId)))
        .returning();

      const [createdSessionItem] = await tx
        .insert(sessionItems)
        .values({
          sessionId,
          menuItemId,
          nameSnapshot: item.name,
          priceSnapshot: item.price,
          qty,
          createdAt: new Date(),
        })
        .returning();

      return { sessionItem: createdSessionItem, menuItem: updatedMenuItem };
    });
  }
}

export const storage = new DatabaseStorage();