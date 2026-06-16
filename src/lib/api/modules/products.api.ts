import { apiClient } from '../client';

export interface Product {
  id: string;
  sku: string;
  name: string;
  stock: number;
  priceCents: number;
  lastUpdated: number;
}

export interface ListProductsResponse {
  success: boolean;
  data: Product[];
  meta?: {
    nextCursor?: string;
  };
}

export const productsApi = {
  /**
   * Fetches remote product listings supporting cursor pagination.
   */
  listProducts: async (params?: {
    limit?: number;
    cursor?: string;
    search?: string;
  }): Promise<ListProductsResponse> => {
    const response = await apiClient.get<ListProductsResponse>('/products', { params });
    return response.data;
  },

  /**
   * Fetches detailed single product metadata by ID.
   */
  getProduct: async (id: string): Promise<{ success: boolean; data: Product }> => {
    const response = await apiClient.get<{ success: boolean; data: Product }>(`/products/${id}`);
    return response.data;
  },
};
export default productsApi;
