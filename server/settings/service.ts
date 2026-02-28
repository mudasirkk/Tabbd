import type { User } from "@shared/schema";
import { settingsStorage } from "./storage";
import { hoursToSeconds } from "./utils";

export type UpdateDiscountSettingsInput = {
  discountThresholdHours: number;
  discountRate: number;
};

export type MeResponse = {
  uid: string;
  email: string | null;
  storeName: string | null;
  discountThresholdSeconds: number;
  discountRate: string;
};

class SettingsService {
  /** Bootstrap user row and return current user for /api/me. */
  async getMe(userId: string, email: string | null): Promise<MeResponse> {
    await settingsStorage.upsertUser({ id: userId, email });
    const user = await settingsStorage.getUserById(userId);
    return {
      uid: userId,
      email: email ?? null,
      storeName: user?.storeName ?? null,
      discountThresholdSeconds: user?.discountThresholdSeconds ?? 20 * 3600,
      discountRate: user?.discountRate ?? "0.2",
    };
  }

  async updateProfile(userId: string, storeName: string): Promise<User> {
    return settingsStorage.updateProfile(userId, storeName);
  }

  /**
   * Update discount threshold (hours → seconds) and discount rate for the user.
   */
  async updateDiscountSettings(
    userId: string,
    input: UpdateDiscountSettingsInput
  ): Promise<User> {
    const discountThresholdSeconds = hoursToSeconds(input.discountThresholdHours);
    const discountRate = input.discountRate.toFixed(4);
    const updated = await settingsStorage.updateDiscountSettings(userId, {
      discountThresholdSeconds,
      discountRate,
    });
    if (!updated) throw new Error("User not found");
    return updated;
  }
}

export const settingsService = new SettingsService();
