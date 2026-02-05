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
import { eq, and, desc, sql, ne } from "drizzle-orm";

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

  async startSession(userId: string, stationId: string, pricingTier: "solo" | "group", startedAt: Date): Promise<Session> {
    const existing = await this.getActiveSessionForStation(userId, stationId);
    if(existing) return existing;

    const[station] = await db
      .select()
      .from(stations)
      .where(and(eq(stations.userId, userId), eq(stations.id, stationId)))
      .limit(1);

    if(!station) throw new Error("Station not found");

    // Drizzle numeric is usually returned as string → keep snapshot as string
    const rateHourlySnapshot =
    pricingTier === "group" ? station.rateGroupHourly : station.rateSoloHourly;


    const[row] = await db
      .insert(sessions)
      .values({ userId, stationId, status: "active", startedAt, pricingTier, rateHourlySnapshot, createdAt: new Date(), updatedAt: new Date(), } as any)
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

  async closeSession(userId: string, sessionId: string): Promise<Session | undefined> {
    const [current] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .limit(1);
    
    if(!current) return undefined;
    
    if(current.status === "closed") return current;

    const closedAt = new Date();
    
    // If currently paused, add the paused time since pausedAt to totalPausedSeconds
    let totalPausedSeconds = current.totalPausedSeconds ?? 0;
    if (current.status === "paused" && current.pausedAt) {
      const extra = Math.max(
        0,
        Math.floor((closedAt.getTime() - current.pausedAt.getTime()) / 1000)
      );
      totalPausedSeconds += extra;
    }

    const startedAtMs = current.startedAt.getTime();
    const closedAtMs = closedAt.getTime();

    const grossSeconds = Math.max(0, Math.floor((closedAtMs - startedAtMs) / 1000));
    const effectiveSeconds = Math.max(0, grossSeconds - totalPausedSeconds);

    const hours = effectiveSeconds / 3600;

    // numeric typically comes back as string
    const rate = Number(current.rateHourlySnapshot ?? 0);
    const timeTotal = Number.isFinite(rate) ? hours * rate : 0;

    // store with 2 decimals (string works well with numeric(10,2))
    const totalAmount = timeTotal.toFixed(2);

    const [row] = await db
      .update(sessions)
      .set({ status: "closed", closedAt, pausedAt: null, totalPausedSeconds, totalAmount, updatedAt: new Date() } as any)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .returning();
    return row || undefined;
  }

  async transferSession(userId: string, sessionId: string, destinationStationId: string): Promise<Session> {
    return await db.transaction(async (tx) => {
      const [sess] = await tx
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
        .limit(1);

      if (!sess) throw new Error("Session not found");
      if (sess.status === "closed") throw new Error("Session is closed");

      if (sess.stationId === destinationStationId) {
        // no-op, but keep it explicit
        return sess;
      }

      // destination station must exist + belong to user
      const [destStation] = await tx
        .select({ id: stations.id })
        .from(stations)
        .where(and(eq(stations.userId, userId), eq(stations.id, destinationStationId)))
        .limit(1);

      if (!destStation) throw new Error("Destination station not found");

      // destination station must NOT have an active (non-closed) session
      const destActive = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            eq(sessions.stationId, destinationStationId),
            sql`${sessions.status} != 'closed'`
          )
        )
        .limit(1);

      if (destActive.length > 0) {
        throw new Error("Destination station already has an active session");
      }

      const [updated] = await tx
        .update(sessions)
        .set({ stationId: destinationStationId, updatedAt: new Date() } as any)
        .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId), ne(sessions.status, "closed")))
        .returning();

      if (!updated) throw new Error("Failed to transfer session");

      return updated;
    });
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

  // Remove a menu item from an active session (restocks qty)
  async removeQtyFromSession(
    userId: string,
    sessionId: string,
    menuItemId: string,
    qty: number
  ): Promise<{ removedQty: number; menuItemId: string }> {
    return await db.transaction(async (tx) => {
      const [sess] = await tx
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
        .limit(1);

      if (!sess) throw new Error("Session not found");
      if (sess.status === "closed") throw new Error("Session is closed");

      // Get session item rows for this menu item, newest first (so removals feel predictable)
      const rows = await tx
        .select()
        .from(sessionItems)
        .where(and(eq(sessionItems.sessionId, sessionId), eq(sessionItems.menuItemId, menuItemId)))
        .orderBy(desc(sessionItems.createdAt));

      const totalHave = rows.reduce((sum, r) => sum + (r.qty ?? 0), 0);
      if (totalHave <= 0) return { removedQty: 0, menuItemId };

      let remaining = Math.min(qty, totalHave);
      let removed = 0;

      for (const row of rows) {
        if (remaining <= 0) break;

        const rowQty = row.qty ?? 0;
        if (rowQty <= 0) continue;

        if (remaining >= rowQty) {
          // delete entire row
          await tx.delete(sessionItems).where(eq(sessionItems.id, row.id));
          remaining -= rowQty;
          removed += rowQty;
        } else {
          // decrement this row
          await tx
            .update(sessionItems)
            .set({ qty: rowQty - remaining } as any)
            .where(eq(sessionItems.id, row.id));
          removed += remaining;
          remaining = 0;
        }
      }

      // Restock if menu item still exists
      const [item] = await tx
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.userId, userId), eq(menuItems.id, menuItemId)))
        .limit(1);

      if (item && removed > 0) {
        await tx
          .update(menuItems)
          .set({ stockQty: (item.stockQty ?? 0) + removed, updatedAt: new Date() })
          .where(and(eq(menuItems.userId, userId), eq(menuItems.id, menuItemId)));
      }

      return { removedQty: removed, menuItemId };
    });
  }
}

export const storage = new DatabaseStorage();