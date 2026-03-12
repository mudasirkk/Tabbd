import { CloverAuthError, CloverApiError } from "./errors";
import type {
  CloverItem,
  CloverCategory,
  CloverItemsResponse,
  CloverCategoriesResponse,
  CloverTokenResponse,
} from "./types";

const CLOVER_API_BASE_URL =
  process.env.CLOVER_API_BASE_URL ?? "https://api.clover.com";

export class CloverApi {
  private accessToken: string;
  private merchantId: string;

  constructor(accessToken: string, merchantId: string) {
    this.accessToken = accessToken;
    this.merchantId = merchantId;
  }

  private get baseUrl(): string {
    return CLOVER_API_BASE_URL;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      throw new CloverAuthError("Clover access token is invalid or expired");
    }

    if (res.status >= 500) {
      const text = await res.text().catch(() => "");
      throw new CloverApiError(
        `Clover API returned ${res.status}: ${text.slice(0, 200)}`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new CloverApiError(
        `Clover API error ${res.status}: ${text.slice(0, 200)}`
      );
    }

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    return res.json() as Promise<T>;
  }

  async fetchAllItems(): Promise<CloverItem[]> {
    const mid = this.merchantId;
    const limit = 100;
    let offset = 0;
    const allItems: CloverItem[] = [];

    while (true) {
      const data = await this.request<CloverItemsResponse>(
        "GET",
        `/v3/merchants/${mid}/items?expand=categories&limit=${limit}&offset=${offset}`
      );

      const elements = data.elements ?? [];
      allItems.push(...elements);

      if (elements.length < limit) {
        break;
      }
      offset += limit;
    }

    return allItems;
  }

  async fetchCategories(): Promise<CloverCategory[]> {
    const mid = this.merchantId;
    const data = await this.request<CloverCategoriesResponse>(
      "GET",
      `/v3/merchants/${mid}/categories`
    );
    return data.elements ?? [];
  }

  async createItem(item: {
    name: string;
    price: number;
    alternateName?: string | null;
    sku?: string | null;
  }): Promise<CloverItem> {
    const mid = this.merchantId;
    return this.request<CloverItem>("POST", `/v3/merchants/${mid}/items`, item);
  }

  async updateItem(
    itemId: string,
    item: {
      name?: string;
      price?: number;
      alternateName?: string | null;
      sku?: string | null;
    }
  ): Promise<CloverItem> {
    const mid = this.merchantId;
    return this.request<CloverItem>(
      "PUT",
      `/v3/merchants/${mid}/items/${itemId}`,
      item
    );
  }

  async createCategory(name: string): Promise<CloverCategory> {
    const mid = this.merchantId;
    return this.request<CloverCategory>(
      "POST",
      `/v3/merchants/${mid}/categories`,
      { name }
    );
  }

  async associateItemCategory(
    itemId: string,
    categoryId: string
  ): Promise<void> {
    const mid = this.merchantId;
    await this.request<void>(
      "POST",
      `/v3/merchants/${mid}/category_items`,
      { elements: [{ item: { id: itemId }, category: { id: categoryId } }] }
    );
  }

  async updateItemStock(itemId: string, stockCount: number): Promise<void> {
    const mid = this.merchantId;
    await this.request<void>(
      "POST",
      `/v3/merchants/${mid}/item_stocks/${itemId}`,
      { quantity: stockCount }
    );
  }
}

export function createCloverApi(
  accessToken: string,
  merchantId: string
): CloverApi {
  return new CloverApi(accessToken, merchantId);
}
