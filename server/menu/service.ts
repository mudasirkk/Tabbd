import type { MenuItem } from "@shared/schema";
import { menuStorage } from "./storage";

class MenuService {
  async listMenu(userId: string): Promise<MenuItem[]> {
    return menuStorage.listMenu(userId);
  }

  async createMenuItem(userId: string, data: Partial<MenuItem>): Promise<MenuItem> {
    return menuStorage.createMenuItem(userId, data);
  }

  async updateMenuItem(
    userId: string,
    id: string,
    patch: Partial<MenuItem>
  ): Promise<MenuItem | undefined> {
    return menuStorage.updateMenuItem(userId, id, patch);
  }

  async deleteMenuItem(userId: string, id: string): Promise<boolean> {
    return menuStorage.deleteMenuItem(userId, id);
  }
}

export const menuService = new MenuService();
