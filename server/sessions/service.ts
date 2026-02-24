import type { Session, SessionItem } from "@shared/schema";
import { sessionStorage, type ClosedSessionHistoryRow } from "./storage";
import {
  SessionConflictError,
  SessionNotFoundError,
  SessionValidationError,
} from "./errors";

type PricingTier = "solo" | "group";

export interface SessionHistoryItemDto {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  lineTotal: number;
  createdAt: string;
}

export interface SessionHistoryDto {
  id: string;
  stationId: string;
  stationName: string;
  stationType: string;
  pricingTier: PricingTier;
  startedAt: string;
  closedAt: string;
  totalPausedSeconds: number;
  effectiveSeconds: number;
  timeCharge: number;
  itemsSubtotal: number;
  grandTotal: number;
  itemCount: number;
  items: SessionHistoryItemDto[];
}

class SessionService {
  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private computeEffectiveSeconds(session: Session): number {
    const closedAtMs = session.closedAt ? session.closedAt.getTime() : Date.now();
    const startedAtMs = session.startedAt.getTime();
    const gross = Math.max(0, Math.floor((closedAtMs - startedAtMs) / 1000));
    return Math.max(0, gross - (session.totalPausedSeconds ?? 0));
  }

  private mapHistoryRow(row: ClosedSessionHistoryRow): SessionHistoryDto {
    const items = row.items.map((item) => {
      const unit = this.toNumber(item.priceSnapshot);
      const lineTotal = unit * item.qty;
      return {
        id: item.id,
        menuItemId: item.menuItemId ?? null,
        nameSnapshot: item.nameSnapshot,
        priceSnapshot: unit,
        qty: item.qty,
        lineTotal,
        createdAt: item.createdAt.toISOString(),
      };
    });
    const itemsSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const timeCharge = this.toNumber(row.totalAmount);
    const grandTotal = timeCharge + itemsSubtotal;
    const itemCount = row.items.reduce((sum, item) => sum + (item.qty ?? 0), 0);

    return {
      id: row.id,
      stationId: row.stationId,
      stationName: row.stationName,
      stationType: row.stationType,
      pricingTier: row.pricingTier,
      startedAt: row.startedAt.toISOString(),
      closedAt: (row.closedAt ?? row.updatedAt).toISOString(),
      totalPausedSeconds: row.totalPausedSeconds ?? 0,
      effectiveSeconds: this.computeEffectiveSeconds(row),
      timeCharge,
      itemsSubtotal,
      grandTotal,
      itemCount,
      items,
    };
  }

  async getActiveSessionWithItems(userId: string, stationId: string): Promise<(Session & { items: SessionItem[] }) | null> {
    const active = await sessionStorage.getActiveSessionForStation(userId, stationId);
    if (!active) return null;
    const items = await sessionStorage.listSessionItems(userId, active.id);
    return { ...active, items };
  }

  async startSession(userId: string, stationId: string, pricingTier: PricingTier, startedAt: Date): Promise<Session> {
    try {
      return await sessionStorage.startSession(userId, stationId, pricingTier, startedAt);
    } catch (err: any) {
      if (err?.message === "Station not found") throw new SessionNotFoundError("Station not found");
      throw err;
    }
  }

  async pauseSession(userId: string, sessionId: string): Promise<Session> {
    const session = await sessionStorage.pauseSession(userId, sessionId);
    if (!session) throw new SessionNotFoundError("Session not found or not active");
    return session;
  }

  async resumeSession(userId: string, sessionId: string): Promise<Session> {
    const session = await sessionStorage.resumeSession(userId, sessionId);
    if (!session) throw new SessionNotFoundError("Session not found or not paused");
    return session;
  }

  async closeSession(
    userId: string,
    sessionId: string,
    pricingTierOverride?: PricingTier
  ): Promise<Session> {
    const session = await sessionStorage.closeSession(userId, sessionId, pricingTierOverride);
    if (!session) throw new SessionNotFoundError("Session not found");
    return session;
  }

  async transferSession(userId: string, sessionId: string, destinationStationId: string): Promise<Session> {
    try {
      return await sessionStorage.transferSession(userId, sessionId, destinationStationId);
    } catch (err: any) {
      if (err?.message === "Session not found" || err?.message === "Destination station not found") {
        throw new SessionNotFoundError(err.message);
      }
      if (err?.message?.includes("already has an active session")) {
        throw new SessionConflictError(err.message);
      }
      if (err?.message?.includes("must be the same type")) {
        throw new SessionValidationError(err.message);
      }
      if (err?.message === "Session is closed") {
        throw new SessionValidationError(err.message);
      }
      throw err;
    }
  }

  async addSessionItem(userId: string, sessionId: string, body: unknown) {
    try {
      return await sessionStorage.addItemToSession(userId, sessionId, body);
    } catch (err: any) {
      if (
        err?.message === "Session not found" ||
        err?.message === "Session is closed" ||
        err?.message === "Menu item not found" ||
        err?.message === "Menu item is inactive" ||
        err?.message === "Insufficient stock"
      ) {
        throw new SessionValidationError(err.message);
      }
      throw err;
    }
  }

  async removeSessionItem(userId: string, sessionId: string, menuItemId: string, qty: number) {
    try {
      return await sessionStorage.removeQtyFromSession(userId, sessionId, menuItemId, qty);
    } catch (err: any) {
      if (err?.message === "Session not found" || err?.message === "Session is closed") {
        throw new SessionValidationError(err.message);
      }
      throw err;
    }
  }

  async listHistory(userId: string): Promise<SessionHistoryDto[]> {
    const rows = await sessionStorage.listClosedSessionsWithItems(userId);
    return rows.map((row) => this.mapHistoryRow(row));
  }
}

export const sessionService = new SessionService();
