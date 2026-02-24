import type { Customer } from "@shared/schema";
import { customerStorage } from "./storage";
import { CustomerConflictError, CustomerNotFoundError, CustomerValidationError } from "./errors";
import { normalizePhoneNumber } from "./utils";

const DISCOUNT_THRESHOLD_SECONDS = 20 * 3600; // 20 hours in seconds

type CreateCustomerData = {
  phoneNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  totalSeconds?: number;
  isDiscountAvailable?: boolean;
};

type UpdateCustomerData = Partial<{
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string;
  totalSeconds: number;
  isDiscountAvailable: boolean;
}>;

class CustomerService {
  async listCustomers(userId: string): Promise<Customer[]> {
    return customerStorage.listCustomers(userId);
  }

  async getCustomerById(userId: string, id: string): Promise<Customer> {
    const customer = await customerStorage.getCustomerById(userId, id);
    if (!customer) throw new CustomerNotFoundError("Customer not found");
    return customer;
  }

  async getCustomerByPhoneNumber(userId: string, phoneNumber: string): Promise<Customer | null> {
    const normalized = normalizePhoneNumber(phoneNumber);
    const customer = await customerStorage.getCustomerByPhoneNumber(userId, normalized);
    return customer ?? null;
  }

  /** Get existing customer by phone or create one with just phoneNumber. */
  async getOrCreateByPhone(
    userId: string,
    phoneNumber: string,
    data?: Partial<CreateCustomerData>
  ): Promise<Customer> {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) throw new CustomerValidationError("Invalid or missing phone number");
    const existing = await customerStorage.getCustomerByPhoneNumber(userId, normalized);
    if (existing) return existing;
    return customerStorage.createCustomer(userId, { phoneNumber: normalized, ...data });
  }

  async createCustomer(userId: string, data: CreateCustomerData): Promise<Customer> {
    const phoneNumber = normalizePhoneNumber(data.phoneNumber);
    if (!phoneNumber) throw new CustomerValidationError("Invalid or missing phone number");
    return customerStorage.createCustomer(userId, { ...data, phoneNumber });
  }

  async updateCustomer(userId: string, id: string, patch: UpdateCustomerData): Promise<Customer> {
    const updated = await customerStorage.updateCustomer(userId, id, patch);
    if (!updated) throw new CustomerNotFoundError("Customer not found");
    return updated;
  }

  async deleteCustomer(userId: string, id: string): Promise<void> {
    const ok = await customerStorage.deleteCustomer(userId, id);
    if (!ok) throw new CustomerNotFoundError("Customer not found");
  }

  /** Add seconds to customer by phone; creates customer if they don't exist. */
  async addSeconds(
    userId: string,
    phoneNumber: string,
    secondsToAdd: number
  ): Promise<Customer> {
    const customer = await this.getOrCreateByPhone(userId, normalizePhoneNumber(phoneNumber));
    const newTotalSeconds = Math.max(0, Math.round(customer.totalSeconds + secondsToAdd));
    const isDiscountAvailable = newTotalSeconds >= DISCOUNT_THRESHOLD_SECONDS;
    const updated = await customerStorage.updateCustomer(userId, customer.id, {
      totalSeconds: newTotalSeconds,
      isDiscountAvailable,
    });
    if (!updated) throw new CustomerNotFoundError("Customer not found");
    return updated;
  }

  /** Returns true if customer qualifies for discount (already has it or will have after secondsPlayed). */
  async checkDiscount({
    userId,
    phoneNumber,
    secondsPlayed,
  }: {
    userId: string;
    phoneNumber: string;
    secondsPlayed: number;
  }): Promise<boolean> {
    const customer = await this.getOrCreateByPhone(userId, normalizePhoneNumber(phoneNumber));
    if (customer.isDiscountAvailable) return true;
    const totalAfter = customer.totalSeconds + secondsPlayed;
    return totalAfter >= DISCOUNT_THRESHOLD_SECONDS;
  }

  /**
   * Apply discount: deduct 20 hours (in seconds) and set isDiscountAvailable.
   * Uses atomic conditional update (only when is_discount_available = true) to prevent double redeem.
   */
  async applyDiscount({
    userId,
    phoneNumber,
    secondsPlayed,
  }: {
    userId: string;
    phoneNumber: string;
    secondsPlayed: number;
  }): Promise<Customer> {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) throw new CustomerValidationError("Invalid or missing phone number");
    await this.getOrCreateByPhone(userId, normalized);
    const updated = await customerStorage.applyDiscountAtomic(
      userId,
      normalized,
      secondsPlayed,
      DISCOUNT_THRESHOLD_SECONDS
    );
    if (!updated) {
      throw new CustomerConflictError("Discount already applied or not eligible");
    }
    return updated;
  }

  async updateTotalSeconds(userId: string, customerId: string, seconds: number): Promise<Customer> {
    const updated = await customerStorage.updateTotalSeconds(userId, customerId, seconds);
    if (!updated) throw new CustomerNotFoundError("Customer not found");
    return updated;
  }
}

export const customerService = new CustomerService();
