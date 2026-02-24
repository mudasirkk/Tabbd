import { customers, type Customer } from "@shared/schema";
import { db } from "../db";
import { and, asc, eq, sql } from "drizzle-orm";

type CreateCustomerData = {
  phoneNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  totalSeconds?: number;
  isDiscountAvailable?: boolean;
};

class CustomerStorage {
  async listCustomers(userId: string): Promise<Customer[]> {
    return db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .orderBy(asc(customers.createdAt));
  }

  async getCustomerById(userId: string, id: string): Promise<Customer | undefined> {
    const [row] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.id, id)));
    return row ?? undefined;
  }

  async getCustomerByPhoneNumber(userId: string, phoneNumber: string): Promise<Customer | undefined> {
    const [row] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.userId, userId), eq(customers.phoneNumber, phoneNumber)));
    return row ?? undefined;
  }

  async createCustomer(userId: string, data: CreateCustomerData): Promise<Customer> {
    const [row] = await db
      .insert(customers)
      .values({
        userId,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phoneNumber: data.phoneNumber,
        totalSeconds: data.totalSeconds ?? 0,
        isDiscountAvailable: data.isDiscountAvailable ?? false,
      })
      .returning();
    if (!row) throw new Error("Failed to create customer");
    return row;
  }

  async updateCustomer(
    userId: string,
    id: string,
    patch: Partial<Pick<Customer, "firstName" | "lastName" | "phoneNumber" | "totalSeconds" | "isDiscountAvailable">>
  ): Promise<Customer | undefined> {
    const totalSeconds = patch.totalSeconds !== undefined ? Math.max(0, Math.round(patch.totalSeconds)) : undefined;
    const [row] = await db
      .update(customers)
      .set({
        ...(patch.firstName !== undefined && { firstName: patch.firstName }),
        ...(patch.lastName !== undefined && { lastName: patch.lastName }),
        ...(patch.phoneNumber !== undefined && { phoneNumber: patch.phoneNumber }),
        ...(totalSeconds !== undefined && { totalSeconds }),
        ...(patch.isDiscountAvailable !== undefined && { isDiscountAvailable: patch.isDiscountAvailable }),
        updatedAt: new Date(),
      })
      .where(and(eq(customers.userId, userId), eq(customers.id, id)))
      .returning();
    return row ?? undefined;
  }

  async deleteCustomer(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(customers)
      .where(and(eq(customers.userId, userId), eq(customers.id, id)))
      .returning();
    return rows.length > 0;
  }

  async updateTotalSeconds(userId: string, customerId: string, totalSeconds: number): Promise<Customer | undefined> {
    const clamped = Math.max(0, Math.round(totalSeconds));
    const [row] = await db
      .update(customers)
      .set({ totalSeconds: clamped, updatedAt: new Date() })
      .where(and(eq(customers.userId, userId), eq(customers.id, customerId)))
      .returning();
    return row ?? undefined;
  }

  /**
   * Atomically apply discount: only updates if customer is eligible (total_seconds + secondsPlayed >= threshold).
   * Same condition as "check" — so if we show "Apply", the update can run. Prevents double redeem because
   * after the first update the row no longer satisfies the condition.
   */
  async applyDiscountAtomic(
    userId: string,
    normalizedPhone: string,
    secondsPlayed: number,
    thresholdSeconds: number
  ): Promise<Customer | undefined> {
    const newTotalExpr = sql`greatest(0, round((${customers.totalSeconds} + ${secondsPlayed} - ${thresholdSeconds})::numeric)::int)`;
    const [row] = await db
      .update(customers)
      .set({
        totalSeconds: newTotalExpr,
        isDiscountAvailable: sql`(${newTotalExpr} >= ${thresholdSeconds})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customers.userId, userId),
          eq(customers.phoneNumber, normalizedPhone),
          sql`(${customers.totalSeconds} + ${secondsPlayed} >= ${thresholdSeconds})`
        )
      )
      .returning();
    return row ?? undefined;
  }
}

export const customerStorage = new CustomerStorage();
