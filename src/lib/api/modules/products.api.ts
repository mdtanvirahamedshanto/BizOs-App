import { apiClient } from '../client';

/** Local (SQLite-cached) product shape used across POS / Inventory. */
export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  stock: number;
  priceCents: number;
  costPriceCents?: number;
  lowStockThreshold?: number;
  lastUpdated: number;
}

/** Product shape as returned by the backend `/products` endpoint. */
export interface BackendProduct {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  stockQuantity: number;
  sellPriceCents: number;
  costPriceCents?: number;
  lowStockThreshold?: number;
  unit?: string;
  isActive?: boolean;
  updatedAt?: string;
}

export interface PaginatedProducts {
  success: boolean;
  data: {
    data: BackendProduct[];
    meta?: {
      nextCursor?: string | null;
      hasMore?: boolean;
      total?: number;
    };
  };
}

export type StockAdjustmentType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'DAMAGE';

export interface StockAdjustmentInput {
  type: StockAdjustmentType;
  quantity: number;
  notes?: string | null;
}

/** Normalize a backend product into the local SQLite cache shape. */
export function mapBackendProduct(p: BackendProduct): Product {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode ?? null,
    name: p.name,
    stock: p.stockQuantity ?? 0,
    priceCents: p.sellPriceCents ?? 0,
    costPriceCents: p.costPriceCents ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 10,
    lastUpdated: p.updatedAt ? new Date(p.updatedAt).getTime() : Date.now(),
  };
}

export const productsApi = {
  /** Fetch a page of products from the backend. */
  listProducts: async (params?: {
    limit?: number;
    cursor?: string;
    search?: string;
  }): Promise<PaginatedProducts> => {
    const response = await apiClient.get<PaginatedProducts>('/products', { params });
    return response.data;
  },

  getProduct: async (id: string): Promise<{ success: boolean; data: BackendProduct }> => {
    const response = await apiClient.get<{ success: boolean; data: BackendProduct }>(`/products/${id}`);
    return response.data;
  },

  /** Record a stock movement (IN/OUT/ADJUSTMENT/DAMAGE) on the backend. */
  adjustStock: async (
    id: string,
    input: StockAdjustmentInput,
  ): Promise<{ success: boolean; data: unknown }> => {
    const response = await apiClient.post<{ success: boolean; data: unknown }>(
      `/products/${id}/stock-adjustments`,
      input,
    );
    return response.data;
  },
};
export default productsApi;
