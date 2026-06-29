// =============================================================================
// BizOS API SDK — Shop Module
// =============================================================================

import { apiClient } from '../client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShopStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type ShopPlan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type BusinessType = 'RETAIL' | 'WHOLESALE' | 'RESTAURANT' | 'SERVICE' | 'OTHERS';

export interface ShopAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface ShopSettings {
  currency: string;
  timezone: string;
  businessType: BusinessType;
  receiptHeader?: string;
  receiptFooter?: string;
  taxId?: string;
}

export interface Shop {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: ShopAddress;
  logo?: string;
  status: ShopStatus;
  plan: ShopPlan;
  settings: ShopSettings;
  createdAt: string;
  updatedAt: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface UpdateShopRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: ShopAddress;
  logo?: string;
  status?: ShopStatus;
  plan?: ShopPlan;
}

export interface UpdateShopSettingsRequest {
  settings: Partial<ShopSettings>;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Get a shop's profile by ID
 */
export async function getShop(shopId: string): Promise<Shop> {
  const res = await apiClient.get<Shop>(`/shops/${shopId}`);
  return res.data;
}

/**
 * Update a shop's core profile fields
 */
export async function updateShop(shopId: string, data: UpdateShopRequest): Promise<Shop> {
  const res = await apiClient.put<Shop>(`/shops/${shopId}`, data);
  return res.data;
}

/**
 * Update a shop's operational settings (currency, timezone, receipt templates…)
 */
export async function updateShopSettings(
  shopId: string,
  data: UpdateShopSettingsRequest,
): Promise<Shop> {
  const res = await apiClient.put<Shop>(`/shops/${shopId}/settings`, data);
  return res.data;
}

/**
 * Permanently delete a shop and all associated data
 */
export async function deleteShop(shopId: string): Promise<void> {
  await apiClient.delete(`/shops/${shopId}`);
}
