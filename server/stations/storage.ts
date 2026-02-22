import { sessions, stations, type Station } from "@shared/schema";
import { db } from "../db";
import { and, asc, eq, sql } from "drizzle-orm";

class StationStorage {
  async listStations(userId: string): Promise<Station[]> {
    return db
      .select()
      .from(stations)
      .where(eq(stations.userId, userId))
      .orderBy(asc(stations.sortOrder), asc(stations.createdAt));
  }

  async createStation(userId: string, data: any): Promise<Station> {
    const [currentMin] = await db
      .select({ minSortOrder: sql<number>`coalesce(min(${stations.sortOrder}), 1)` })
      .from(stations)
      .where(eq(stations.userId, userId));

    const nextSortOrder = (currentMin?.minSortOrder ?? 1) - 1;

    const [row] = await db
      .insert(stations)
      .values({
        userId,
        ...data,
        sortOrder: nextSortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  async updateStation(userId: string, id: string, patch: Partial<Station>): Promise<Station | undefined> {
    const [row] = await db
      .update(stations)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(stations.userId, userId), eq(stations.id, id)))
      .returning();
    return row || undefined;
  }

  async deleteStation(userId: string, id: string): Promise<boolean> {
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

  async reorderStations(userId: string, stationIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: stations.id })
        .from(stations)
        .where(eq(stations.userId, userId));

      const existingIds = existing.map((row) => row.id);
      const existingSet = new Set(existingIds);
      const incomingSet = new Set(stationIds);

      if (
        existingIds.length !== stationIds.length ||
        incomingSet.size !== stationIds.length ||
        stationIds.some((id) => !existingSet.has(id))
      ) {
        throw new Error("Station reorder payload must include each station exactly once");
      }

      for (let i = 0; i < stationIds.length; i += 1) {
        await tx
          .update(stations)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(stations.userId, userId), eq(stations.id, stationIds[i])));
      }
    });
  }
}

export const stationStorage = new StationStorage();
