// services/customers.service.ts
import { customerStorage } from "./storage";

class Customer {

    async checkDiscount({storeId, phoneNumber, hoursPlayed}: {storeId: string, phoneNumber: string, hoursPlayed: number}): Promise<boolean> {
        const customer = await this.getCustomerById(storeId, phoneNumber);
        if (customer.isDiscountAvailable) return true;

        const totalHours = customer.totalHours + hoursPlayed;
        return totalHours >= 20;
    }

    async getCustomerById(storeId: string, phoneNumber: string) {
        var customer = await customerStorage.getCustomerById(storeId, phoneNumber);
        if (!customer) {
        customer = await customerStorage.createCustomer(storeId, phoneNumber);
        }
        return customer;
    }

    async applyDiscount({storeId, phoneNumber, hoursPlayed}: {storeId: string, phoneNumber: string, hoursPlayed: number}): Promise<void> {
        const customer = await this.getCustomerById(storeId, phoneNumber);
        await this.updateTotalHours(customer.id, customer.totalHours + hoursPlayed - 20);
    }

    async updateTotalHours(customerId: string, hours: number): Promise<void> {
        await customerStorage.updateTotalHours(customerId, hours);
    }

}

export const customer = new Customer();
