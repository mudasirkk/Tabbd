import type { Session, SessionItem, SessionTimeSegment } from "@shared/schema";
import { sessionStorage, type ClosedSessionHistoryRow, type CloseSessionInput } from "./storage";
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

export interface SessionTimeSegmentDto {
  id: string;
  sequence: number;
  stationId: string;
  stationName: string;
  stationType: string;
  startedAt: string;
  endedAt: string;
  effectiveSeconds: number;
  pricingTier: PricingTier;
  rateSoloHourlySnapshot: number;
  rateGroupHourlySnapshot: number;
  rateHourlyApplied: number;
  timeAmount: number;
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
  timeSegments: SessionTimeSegmentDto[];
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

  private mapSegment(segment: SessionTimeSegment): SessionTimeSegmentDto {
    return {
      id: segment.id,
      sequence: segment.sequence,
      stationId: segment.stationId,
      stationName: segment.stationNameSnapshot,
      stationType: segment.stationTypeSnapshot,
      startedAt: segment.startedAt.toISOString(),
      endedAt: segment.endedAt.toISOString(),
      effectiveSeconds: segment.effectiveSeconds,
      pricingTier: segment.pricingTier,
      rateSoloHourlySnapshot: this.toNumber(segment.rateSoloHourlySnapshot),
      rateGroupHourlySnapshot: this.toNumber(segment.rateGroupHourlySnapshot),
      rateHourlyApplied: this.toNumber(segment.rateHourlyApplied),
      timeAmount: this.toNumber(segment.timeAmount),
    };
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

    const timeSegments = (row.timeSegments ?? []).map((segment) => this.mapSegment(segment));
    const summedSeconds = timeSegments.reduce((sum, segment) => sum + segment.effectiveSeconds, 0);
    const summedAmount = timeSegments.reduce((sum, segment) => sum + segment.timeAmount, 0);

    const timeCharge = timeSegments.length > 0 ? summedAmount : this.toNumber(row.totalAmount);
    const effectiveSeconds = timeSegments.length > 0 ? summedSeconds : this.computeEffectiveSeconds(row);
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
      effectiveSeconds,
      timeCharge,
      itemsSubtotal,
      grandTotal,
      itemCount,
      items,
      timeSegments,
    };
  }

  async getActiveSessionWithItems(userId: string, stationId: string): Promise<(Session & {
    items: SessionItem[];
    timeSegments: SessionTimeSegmentDto[];
    accruedTimeSeconds: number;
    accruedTimeCharge: number;
  }) | null> {
    const active = await sessionStorage.getActiveSessionForStation(userId, stationId);
    if (!active) return null;
    const items = await sessionStorage.listSessionItems(userId, active.id);
    const segments = await sessionStorage.listSessionTimeSegments(userId, active.id);
    const mappedSegments = segments.map((segment) => this.mapSegment(segment));
    const accruedTimeSeconds = mappedSegments.reduce((sum, segment) => sum + segment.effectiveSeconds, 0);
    const accruedTimeCharge = mappedSegments.reduce((sum, segment) => sum + segment.timeAmount, 0);

    return {
      ...active,
      items,
      timeSegments: mappedSegments,
      accruedTimeSeconds,
      accruedTimeCharge,
    };
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
    input?: CloseSessionInput
  ): Promise<Session> {
    const session = await sessionStorage.closeSession(userId, sessionId, input);
    if (!session) throw new SessionNotFoundError("Session not found");
    return session;
  }

  async transferSession(
    userId: string,
    sessionId: string,
    destinationStationId: string,
    endingPricingTier?: PricingTier,
    nextPricingTier?: PricingTier,
  ): Promise<Session> {
    try {
      return await sessionStorage.transferSession(
        userId,
        sessionId,
        destinationStationId,
        endingPricingTier,
        nextPricingTier,
      );
    } catch (err: any) {
      if (err?.message === "Session not found" || err?.message === "Destination station not found") {
        throw new SessionNotFoundError(err.message);
      }
      if (err?.message?.includes("already has an active session")) {
        throw new SessionConflictError(err.message);
      }
      if (err?.message === "Session is closed") {
        throw new SessionValidationError(err.message);
      }
      if (err?.message === "Invalid segment override") {
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
