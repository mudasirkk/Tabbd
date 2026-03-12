export interface CloverItem {
  id: string;
  name: string;
  alternateName?: string | null;
  price: number; // cents
  sku?: string | null;
  stockCount?: number;
  categories?: { elements: CloverCategory[] };
}

export interface CloverCategory {
  id: string;
  name: string;
}

export interface CloverItemsResponse {
  elements: CloverItem[];
  href?: string;
}

export interface CloverCategoriesResponse {
  elements: CloverCategory[];
}

export interface CloverTokenResponse {
  access_token: string;
}
