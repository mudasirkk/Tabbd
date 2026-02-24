import {
  addSessionItemSchema,
  menuItems,
  sessions,
  sessionItems,
  stations,
  type MenuItem,
  type Session,
  type SessionItem,
} from "@shared/schema";
import { db } from "../db";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

export type ClosedSessionHistoryRow = Session & {
  stationName: string;
  stationType: string;
  items: SessionItem[];
};

class SessionStorage {
  async getActiveSessionForStation(userId: string, stationId: string): Promise<Session | undefined> {
    const [row] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.stationId, stationId),
          sql`${sessions.status} != 'closed'`
        )
      )
      .orderBy(desc(sessions.createdAt))
      .limit(1);
    return row || undefined;
  }

  async startSession(
    userId: string,
    stationId: string,
    pricingTier: "solo" | "group",
    startedAt: Date
  ): Promise<Session> {
    const existing = await this.getActiveSessionForStation(userId, stationId);
    if (existing) return existing;

    const [station] = await db
      .select()
      .from(stations)
      .where(and(eq(stations.userId, userId), eq(stations.id, stationId)))
      .limit(1);

    if (!station) {
      throw new Error("Station not found");
    }

    const rateHourlySnapshot =
      pricingTier === "group" ? station.rateGroupHourly : station.rateSoloHourly;

    const [row] = await db
      .insert(sessions)
      .values({
        userId,
        stationId,
        status: "active",
        startedAt,
        pricingTier,
        rateHourlySnapshot,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return row;
  }

  async pauseSession(userId: string, sessionId: string): Promise<Session | undefined> {
    const [row] = await db
      .update(sessions)
      .set({ status: "paused", pausedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId), eq(sessions.status, "active")))
      .returning();
    return row || undefined;
  }

  async resumeSession(userId: string, sessionId: string): Promise<Session | undefined> {
    const [current] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .limit(1);
    if (!current || current.status !== "paused" || !current.pausedAt) return undefined;

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

  async closeSession(
    userId: string,
    sessionId: string,
    pricingTierOverride?: "solo" | "group"
  ): Promise<Session | undefined> {
    const [current] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .limit(1);

    if (!current) return undefined;
    if (current.status === "closed") return current;

    const closedAt = new Date();
    let totalPausedSeconds = current.totalPausedSeconds ?? 0;

    if (current.status === "paused" && current.pausedAt) {
      const extra = Math.max(0, Math.floor((closedAt.getTime() - current.pausedAt.getTime()) / 1000));
      totalPausedSeconds += extra;
    }

    const effectivePricingTier = pricingTierOverride ?? current.pricingTier;
    const [station] = await db
      .select({
        rateSoloHourly: stations.rateSoloHourly,
        rateGroupHourly: stations.rateGroupHourly,
      })
      .from(stations)
      .where(and(eq(stations.userId, userId), eq(stations.id, current.stationId)))
      .limit(1);

    const selectedRateRaw =
      effectivePricingTier === "solo" ? station?.rateSoloHourly : station?.rateGroupHourly;
    const selectedRate = Number(selectedRateRaw ?? current.rateHourlySnapshot ?? 0);
    const safeRate = Number.isFinite(selectedRate) ? selectedRate : 0;

    const grossSeconds = Math.max(
      0,
      Math.floor((closedAt.getTime() - current.startedAt.getTime()) / 1000)
    );
    const effectiveSeconds = Math.max(0, grossSeconds - totalPausedSeconds);
    const hours = effectiveSeconds / 3600;
    const timeTotal = hours * safeRate;
    const totalAmount = timeTotal.toFixed(2);

    const [row] = await db
      .update(sessions)
      .set({
        status: "closed",
        closedAt,
        pausedAt: null,
        totalPausedSeconds,
        pricingTier: effectivePricingTier,
        rateHourlySnapshot: safeRate.toFixed(2),
        totalAmount,
        updatedAt: new Date(),
      } as any)
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
      if (sess.stationId === destinationStationId) return sess;

      const [destStation] = await tx
        .select({ id: stations.id, stationType: stations.stationType })
        .from(stations)
        .where(and(eq(stations.userId, userId), eq(stations.id, destinationStationId)))
        .limit(1);
      if (!destStation) throw new Error("Destination station not found");

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

      if (destActive.length > 0) throw new Error("Destination station already has an active session");

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
    const [sess] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .limit(1);
    if (!sess) return [];

    return db
      .select()
      .from(sessionItems)
      .where(eq(sessionItems.sessionId, sessionId))
      .orderBy(desc(sessionItems.createdAt));
  }

  async addItemToSession(userId: string, sessionId: string, input: unknown): Promise<{ sessionItem: SessionItem; menuItem: MenuItem }> {
    const { menuItemId, qty } = addSessionItemSchema.parse(input);

    return await db.transaction(async (tx) => {
      const [sess] = await tx
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
        .limit(1);
      if (!sess) throw new Error("Session not found");
      if (sess.status === "closed") throw new Error("Session is closed");

      const [item] = await tx
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.userId, userId), eq(menuItems.id, menuItemId)))
        .limit(1);
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
          await tx.delete(sessionItems).where(eq(sessionItems.id, row.id));
          remaining -= rowQty;
          removed += rowQty;
        } else {
          await tx
            .update(sessionItems)
            .set({ qty: rowQty - remaining } as any)
            .where(eq(sessionItems.id, row.id));
          removed += remaining;
          remaining = 0;
        }
      }

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

  async listClosedSessionsWithItems(userId: string): Promise<ClosedSessionHistoryRow[]> {
    const closed = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        stationId: sessions.stationId,
        status: sessions.status,
        startedAt: sessions.startedAt,
        pausedAt: sessions.pausedAt,
        totalPausedSeconds: sessions.totalPausedSeconds,
        closedAt: sessions.closedAt,
        pricingTier: sessions.pricingTier,
        rateHourlySnapshot: sessions.rateHourlySnapshot,
        totalAmount: sessions.totalAmount,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        stationName: stations.name,
        stationType: stations.stationType,
      })
      .from(sessions)
      .innerJoin(stations, and(eq(stations.id, sessions.stationId), eq(stations.userId, userId)))
      .where(and(eq(sessions.userId, userId), eq(sessions.status, "closed")))
      .orderBy(desc(sessions.closedAt), desc(sessions.createdAt));

    if (closed.length === 0) return [];

    const sessionIds = closed.map((row) => row.id);
    const allItems = await db
      .select()
      .from(sessionItems)
      .where(inArray(sessionItems.sessionId, sessionIds))
      .orderBy(asc(sessionItems.createdAt));

    const itemsBySession = new Map<string, SessionItem[]>();
    for (const row of allItems) {
      const existing = itemsBySession.get(row.sessionId) ?? [];
      existing.push(row);
      itemsBySession.set(row.sessionId, existing);
    }

    return closed.map((row) => ({
      ...row,
      items: itemsBySession.get(row.id) ?? [],
    }));
  }
}

export const sessionStorage = new SessionStorage();
