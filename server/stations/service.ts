import type { Station } from "@shared/schema";
import { stationStorage } from "./storage";
import { sessionService } from "../sessions/service";
import { StationNotFoundError, StationValidationError } from "./errors";

class StationService {
  async listStations(userId: string) {
    const data = await stationStorage.listStations(userId);
    return Promise.all(
      data.map(async (st) => {
        const activeSession = await sessionService.getActiveSessionWithItems(userId, st.id);
        return { ...st, activeSession };
      })
    );
  }

  async createStation(userId: string, data: unknown): Promise<Station> {
    return stationStorage.createStation(userId, data as any);
  }

  async updateStation(userId: string, id: string, patch: Partial<Station>): Promise<Station> {
    const updated = await stationStorage.updateStation(userId, id, patch);
    if (!updated) throw new StationNotFoundError("Station not found");
    return updated;
  }

  async deleteStation(userId: string, id: string): Promise<void> {
    try {
      const ok = await stationStorage.deleteStation(userId, id);
      if (!ok) throw new StationNotFoundError("Station not found");
    } catch (err: any) {
      if (err?.message?.includes("active session")) {
        throw new StationValidationError(err.message);
      }
      throw err;
    }
  }

  async reorderStations(userId: string, stationIds: string[]): Promise<void> {
    try {
      await stationStorage.reorderStations(userId, stationIds);
    } catch (err: any) {
      if (err?.message?.includes("must include each station exactly once")) {
        throw new StationValidationError(err.message);
      }
      throw err;
    }
  }
}

export const stationService = new StationService();
