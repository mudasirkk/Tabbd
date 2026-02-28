import type { Customer } from "@shared/schema";
import { customerStorage } from "./storage";
import { settingsStorage } from "../settings/storage";
import { CustomerConflictError, CustomerNotFoundError, CustomerValidationError } from "./errors";
import { normalizePhoneNumber } from "./utils";

/** Default from users schema when user row not found */
const DEFAULT_DISCOUNT_THRESHOLD_SECONDS = 20 * 3600;

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

export type ApplyDiscountResult = { customer: Customer; discountRate: string };

class CustomerService {

    private async getDiscountSettings(userId: string): Promise<{ discountThresholdSeconds: number; discountRate: string }> {
        const user = await settingsStorage.getUserById(userId);
        return { discountThresholdSeconds: user?.discountThresholdSeconds ?? DEFAULT_DISCOUNT_THRESHOLD_SECONDS, discountRate: user?.discountRate ?? "0.2" };
    }
    
  private async getDiscountThresholdSeconds(userId: string): Promise<number> {
    const user = await settingsStorage.getUserById(userId);
    return user?.discountThresholdSeconds ?? DEFAULT_DISCOUNT_THRESHOLD_SECONDS;
  }

  private async getDiscountRate(userId: string): Promise<string> {
    const user = await settingsStorage.getUserById(userId);
    return user?.discountRate ?? "0.2";
  }

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
    const thresholdSeconds = await this.getDiscountThresholdSeconds(userId);
    const customer = await this.getOrCreateByPhone(userId, normalizePhoneNumber(phoneNumber));
    const newTotalSeconds = Math.max(0, Math.round(customer.totalSeconds + secondsToAdd));
    const isDiscountAvailable = newTotalSeconds >= thresholdSeconds;
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
    const thresholdSeconds = await this.getDiscountThresholdSeconds(userId);
    const customer = await this.getOrCreateByPhone(userId, normalizePhoneNumber(phoneNumber));
    if (customer.isDiscountAvailable) return true;
    const totalAfter = customer.totalSeconds + secondsPlayed;
    return totalAfter >= thresholdSeconds;
  }

  /**
   * Apply discount: deduct threshold (user's hours setting) and set isDiscountAvailable.
   * Uses atomic conditional update (only when is_discount_available = true) to prevent double redeem.
   * Returns the customer and the store's discount rate for the frontend to apply to the total.
   */
  async applyDiscount({
    userId,
    phoneNumber,
    secondsPlayed,
  }: {
    userId: string;
    phoneNumber: string;
    secondsPlayed: number;
  }): Promise<ApplyDiscountResult> {
    const { discountThresholdSeconds, discountRate } = await this.getDiscountSettings(userId);
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) throw new CustomerValidationError("Invalid or missing phone number");
    await this.getOrCreateByPhone(userId, normalized);
    const updated = await customerStorage.applyDiscountAtomic(
      userId,
      normalized,
      secondsPlayed,
      discountThresholdSeconds
    );
    if (!updated) {
      throw new CustomerConflictError("Discount already applied or not eligible");
    }
    return { customer: updated, discountRate };
  }

  async updateTotalSeconds(userId: string, customerId: string, seconds: number): Promise<Customer> {
    const updated = await customerStorage.updateTotalSeconds(userId, customerId, seconds);
    if (!updated) throw new CustomerNotFoundError("Customer not found");
    return updated;
  }
}

export const customerService = new CustomerService();
