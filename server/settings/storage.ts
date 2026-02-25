import { users, type User } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export class SettingsStorage {
  async upsertUser(params: { id: string; email?: string | null }): Promise<User> {
    const defaultThreshold = 20 * 3600;
    const defaultRate = "0.2";
    const [row] = await db
      .insert(users)
      .values({
        id: params.id,
        email: params.email ?? null,
        discountThresholdSeconds: defaultThreshold,
        discountRate: defaultRate,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: params.email ?? null, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? undefined;
  }

  async updateProfile(userId: string, storeName: string): Promise<User> {
    const [row] = await db
      .update(users)
      .set({ storeName, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async updateDiscountSettings(
    userId: string,
    data: { discountThresholdSeconds: number; discountRate: string }
  ): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({
        discountThresholdSeconds: data.discountThresholdSeconds,
        discountRate: data.discountRate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return row ?? undefined;
  }
}

export const settingsStorage = new SettingsStorage();
