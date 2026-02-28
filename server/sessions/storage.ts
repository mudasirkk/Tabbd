import {
  addSessionItemSchema,
  menuItems,
  sessions,
  sessionItems,
  sessionTimeSegments,
  stations,
  type MenuItem,
  type Session,
  type SessionItem,
  type SessionTimeSegment,
} from "@shared/schema";
import { db } from "../db";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

export type ClosedSessionHistoryRow = Session & {
  stationName: string;
  stationType: string;
  items: SessionItem[];
  timeSegments: SessionTimeSegment[];
};

type PricingTier = "solo" | "group";

export type CloseSessionInput = {
  pricingTier?: PricingTier;
  currentSegmentPricingTier?: PricingTier;
  segmentTierOverrides?: Array<{ segmentId: string; pricingTier: PricingTier }>;
};

class SessionStorage {
  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private computeSegmentMetrics(params: {
    startedAt: Date;
    endedAt: Date;
    totalPausedSeconds: number;
  }): { effectiveSeconds: number; timeHours: number } {
    const grossSeconds = Math.max(0, Math.floor((params.endedAt.getTime() - params.startedAt.getTime()) / 1000));
    const effectiveSeconds = Math.max(0, grossSeconds - params.totalPausedSeconds);
    return { effectiveSeconds, timeHours: effectiveSeconds / 3600 };
  }

  private getAppliedRate(
    pricingTier: PricingTier,
    rateSoloHourlySnapshot: string | number | null | undefined,
    rateGroupHourlySnapshot: string | number | null | undefined,
  ): number {
    const solo = this.toNumber(rateSoloHourlySnapshot);
    const group = this.toNumber(rateGroupHourlySnapshot);
    return pricingTier === "solo" ? solo : group;
  }

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
    pricingTier: PricingTier,
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

  private async applySegmentTierOverrides(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    userId: string,
    sessionId: string,
    overrides: Array<{ segmentId: string; pricingTier: PricingTier }>,
  ): Promise<void> {
    if (overrides.length === 0) return;

    const segmentIds = overrides.map((x) => x.segmentId);
    const rows = await tx
      .select({
        id: sessionTimeSegments.id,
        sessionId: sessionTimeSegments.sessionId,
        rateSoloHourlySnapshot: sessionTimeSegments.rateSoloHourlySnapshot,
        rateGroupHourlySnapshot: sessionTimeSegments.rateGroupHourlySnapshot,
        effectiveSeconds: sessionTimeSegments.effectiveSeconds,
      })
      .from(sessionTimeSegments)
      .innerJoin(sessions, and(eq(sessions.id, sessionTimeSegments.sessionId), eq(sessions.userId, userId)))
      .where(and(eq(sessionTimeSegments.sessionId, sessionId), inArray(sessionTimeSegments.id, segmentIds)));

    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const override of overrides) {
      const row = byId.get(override.segmentId);
      if (!row) throw new Error("Invalid segment override");
      const appliedRate = this.getAppliedRate(
        override.pricingTier,
        row.rateSoloHourlySnapshot,
        row.rateGroupHourlySnapshot,
      );
      const timeAmount = ((Math.max(0, row.effectiveSeconds) / 3600) * appliedRate).toFixed(2);

      await tx
        .update(sessionTimeSegments)
        .set({
          pricingTier: override.pricingTier,
          rateHourlyApplied: appliedRate.toFixed(2),
          timeAmount,
          updatedAt: new Date(),
        } as any)
        .where(eq(sessionTimeSegments.id, override.segmentId));
    }
  }

  private async createSegmentSnapshot(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    input: {
      session: Session;
      stationId: string;
      stationNameSnapshot: string;
      stationTypeSnapshot: string;
      endedAt: Date;
      pricingTier: PricingTier;
      rateSoloHourlySnapshot: string | number;
      rateGroupHourlySnapshot: string | number;
      totalPausedSeconds: number;
    },
  ): Promise<SessionTimeSegment> {
    const metrics = this.computeSegmentMetrics({
      startedAt: input.session.startedAt,
      endedAt: input.endedAt,
      totalPausedSeconds: input.totalPausedSeconds,
    });

    const appliedRate = this.getAppliedRate(
      input.pricingTier,
      input.rateSoloHourlySnapshot,
      input.rateGroupHourlySnapshot,
    );

    const [seqRow] = await tx
      .select({ max: sql<number>`coalesce(max(${sessionTimeSegments.sequence}), 0)` })
      .from(sessionTimeSegments)
      .where(eq(sessionTimeSegments.sessionId, input.session.id));

    const nextSequence = (seqRow?.max ?? 0) + 1;

    const [created] = await tx
      .insert(sessionTimeSegments)
      .values({
        sessionId: input.session.id,
        sequence: nextSequence,
        stationId: input.stationId,
        stationNameSnapshot: input.stationNameSnapshot,
        stationTypeSnapshot: input.stationTypeSnapshot,
        startedAt: input.session.startedAt,
        endedAt: input.endedAt,
        effectiveSeconds: metrics.effectiveSeconds,
        pricingTier: input.pricingTier,
        rateSoloHourlySnapshot: this.toNumber(input.rateSoloHourlySnapshot).toFixed(2),
        rateGroupHourlySnapshot: this.toNumber(input.rateGroupHourlySnapshot).toFixed(2),
        rateHourlyApplied: appliedRate.toFixed(2),
        timeAmount: (metrics.timeHours * appliedRate).toFixed(2),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    return created;
  }

  async closeSession(
    userId: string,
    sessionId: string,
    input?: CloseSessionInput
  ): Promise<Session | undefined> {
    return db.transaction(async (tx) => {
      const [current] = await tx
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

      const currentSegmentPricingTier = input?.currentSegmentPricingTier ?? input?.pricingTier ?? current.pricingTier;
      const effectivePricingTier = currentSegmentPricingTier;

      const [station] = await tx
        .select({
          name: stations.name,
          stationType: stations.stationType,
          rateSoloHourly: stations.rateSoloHourly,
          rateGroupHourly: stations.rateGroupHourly,
        })
        .from(stations)
        .where(and(eq(stations.userId, userId), eq(stations.id, current.stationId)))
        .limit(1);

      if (!station) throw new Error("Station not found");

      const overrides = input?.segmentTierOverrides ?? [];
      await this.applySegmentTierOverrides(tx, userId, sessionId, overrides);

      await this.createSegmentSnapshot(tx, {
        session: current,
        stationId: current.stationId,
        stationNameSnapshot: station.name,
        stationTypeSnapshot: station.stationType,
        endedAt: closedAt,
        pricingTier: effectivePricingTier,
        rateSoloHourlySnapshot: station.rateSoloHourly,
        rateGroupHourlySnapshot: station.rateGroupHourly,
        totalPausedSeconds,
      });

      const [sumRow] = await tx
        .select({ total: sql<string>`coalesce(sum(${sessionTimeSegments.timeAmount}), 0)` })
        .from(sessionTimeSegments)
        .where(eq(sessionTimeSegments.sessionId, sessionId));
      const totalAmount = this.toNumber(sumRow?.total).toFixed(2);

      const selectedRateRaw =
        effectivePricingTier === "solo" ? station.rateSoloHourly : station.rateGroupHourly;
      const selectedRate = this.toNumber(selectedRateRaw);

      const [row] = await tx
        .update(sessions)
        .set({
          status: "closed",
          closedAt,
          pausedAt: null,
          totalPausedSeconds,
          pricingTier: effectivePricingTier,
          rateHourlySnapshot: selectedRate.toFixed(2),
          totalAmount,
          updatedAt: new Date(),
        } as any)
        .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
        .returning();

      return row || undefined;
    });
  }

  async transferSession(
    userId: string,
    sessionId: string,
    destinationStationId: string,
    endingPricingTier?: PricingTier,
    nextPricingTier?: PricingTier,
  ): Promise<Session> {
    return await db.transaction(async (tx) => {
      const [sess] = await tx
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
        .limit(1);

      if (!sess) throw new Error("Session not found");
      if (sess.status === "closed") throw new Error("Session is closed");
      if (sess.stationId === destinationStationId) return sess;

      const [sourceStation] = await tx
        .select({
          id: stations.id,
          name: stations.name,
          stationType: stations.stationType,
          rateSoloHourly: stations.rateSoloHourly,
          rateGroupHourly: stations.rateGroupHourly,
        })
        .from(stations)
        .where(and(eq(stations.userId, userId), eq(stations.id, sess.stationId)))
        .limit(1);

      if (!sourceStation) throw new Error("Station not found");

      const [destStation] = await tx
        .select({
          id: stations.id,
          stationType: stations.stationType,
          rateSoloHourly: stations.rateSoloHourly,
          rateGroupHourly: stations.rateGroupHourly,
        })
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

      const endedAt = sess.status === "paused" && sess.pausedAt ? sess.pausedAt : new Date();
      const now = new Date();
      const priorTier = endingPricingTier ?? sess.pricingTier;

      await this.createSegmentSnapshot(tx, {
        session: sess,
        stationId: sourceStation.id,
        stationNameSnapshot: sourceStation.name,
        stationTypeSnapshot: sourceStation.stationType,
        endedAt,
        pricingTier: priorTier,
        rateSoloHourlySnapshot: sourceStation.rateSoloHourly,
        rateGroupHourlySnapshot: sourceStation.rateGroupHourly,
        totalPausedSeconds: sess.totalPausedSeconds ?? 0,
      });

      const nextTier = nextPricingTier ?? priorTier;
      const nextRate = this.getAppliedRate(nextTier, destStation.rateSoloHourly, destStation.rateGroupHourly);

      const [updated] = await tx
        .update(sessions)
        .set({
          stationId: destinationStationId,
          startedAt: now,
          pausedAt: sess.status === "paused" ? now : null,
          totalPausedSeconds: 0,
          pricingTier: nextTier,
          rateHourlySnapshot: nextRate.toFixed(2),
          updatedAt: now,
        } as any)
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

  async listSessionTimeSegments(userId: string, sessionId: string): Promise<SessionTimeSegment[]> {
    const [sess] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
      .limit(1);
    if (!sess) return [];

    return db
      .select()
      .from(sessionTimeSegments)
      .where(eq(sessionTimeSegments.sessionId, sessionId))
      .orderBy(asc(sessionTimeSegments.sequence), asc(sessionTimeSegments.createdAt));
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

    const allSegments = await db
      .select()
      .from(sessionTimeSegments)
      .where(inArray(sessionTimeSegments.sessionId, sessionIds))
      .orderBy(asc(sessionTimeSegments.sequence), asc(sessionTimeSegments.createdAt));

    const itemsBySession = new Map<string, SessionItem[]>();
    for (const row of allItems) {
      const existing = itemsBySession.get(row.sessionId) ?? [];
      existing.push(row);
      itemsBySession.set(row.sessionId, existing);
    }

    const segmentsBySession = new Map<string, SessionTimeSegment[]>();
    for (const row of allSegments) {
      const existing = segmentsBySession.get(row.sessionId) ?? [];
      existing.push(row);
      segmentsBySession.set(row.sessionId, existing);
    }

    return closed.map((row) => ({
      ...row,
      items: itemsBySession.get(row.id) ?? [],
      timeSegments: segmentsBySession.get(row.id) ?? [],
    }));
  }
}

export const sessionStorage = new SessionStorage();
