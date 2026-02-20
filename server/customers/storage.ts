import { customers, type Customer } from "@shared/schema";
import { db } from "../db";
import { and, eq } from "drizzle-orm";

class CustomerStorage {
  async getCustomerById(storeId: string, phoneNumber: string): Promise<Customer | undefined> {
    const [row] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.phoneNumber, phoneNumber)));
    return row ?? undefined;
  }

  async createCustomer(storeId: string, phoneNumber: string): Promise<Customer> {
    const [row] = await db.insert(customers).values({ storeId, phoneNumber }).returning();
    return row;
  }

  async updateTotalHours(customerId: string, totalHours: number): Promise<void> {
    if (totalHours < 0) totalHours = 0;
    await db.update(customers).set({ totalHours: totalHours }).where(eq(customers.id, customerId));
  }
}

export const customerStorage = new CustomerStorage(); 