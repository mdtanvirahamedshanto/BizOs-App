// =============================================================================
// BizOS API SDK — MFS (Mobile Financial Services) Module
// =============================================================================

import { apiClient, buildParams } from '../client';
import { PaginatedResponse, PaginationParams, TransactionStatus } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MfsProvider = 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY';
export type MfsAccountType = 'AGENT' | 'MERCHANT' | 'PERSONAL';
export type MfsTransactionType =
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'SEND_MONEY'
  | 'MERCHANT_PAY'
  | 'BILL_PAY'
  | 'ADJUSTMENT';

export interface MfsAccount {
  id: string;
  shopId: string;
  provider: MfsProvider;
  accountNumber: string;
  accountType: MfsAccountType;
  balanceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MfsTransaction {
  id: string;
  shopId: string;
  mfsAccountId: string;
  mfsAccount?: Pick<MfsAccount, 'id' | 'provider' | 'accountNumber'>;
  type: MfsTransactionType;
  customerPhone: string;
  amountCents: number;
  feeCents: number;
  commissionCents: number;
  netAmountCents: number;
  txid?: string;
  status: TransactionStatus;
  notes?: string;
  createdAt: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface CreateMfsAccountRequest {
  provider: MfsProvider;
  accountNumber: string;
  accountType?: MfsAccountType;
  balanceCents?: number;
  isActive?: boolean;
}

export type UpdateMfsAccountRequest = Partial<CreateMfsAccountRequest>;

export interface CreateMfsTransactionRequest {
  mfsAccountId: string;
  type: MfsTransactionType;
  customerPhone: string;
  amountCents: number;
  feeCents?: number;
  commissionCents?: number;
  txid?: string;
  status?: TransactionStatus;
  notes?: string;
}

export interface MfsTransactionQueryParams extends PaginationParams {
  mfsAccountId?: string;
  provider?: MfsProvider;
  type?: MfsTransactionType;
  startDate?: Date;
  endDate?: Date;
}

// ─── MFS Account API ──────────────────────────────────────────────────────────

export async function createMfsAccount(data: CreateMfsAccountRequest): Promise<MfsAccount> {
  const res = await apiClient.post<MfsAccount>('/mfs/accounts', data);
  return res.data;
}

export async function listMfsAccounts(): Promise<MfsAccount[]> {
  const res = await apiClient.get<MfsAccount[]>('/mfs/accounts');
  return res.data;
}

export async function getMfsAccount(accountId: string): Promise<MfsAccount> {
  const res = await apiClient.get<MfsAccount>(`/mfs/accounts/${accountId}`);
  return res.data;
}

export async function updateMfsAccount(
  accountId: string,
  data: UpdateMfsAccountRequest,
): Promise<MfsAccount> {
  const res = await apiClient.put<MfsAccount>(`/mfs/accounts/${accountId}`, data);
  return res.data;
}

// ─── MFS Transaction API ──────────────────────────────────────────────────────

/**
 * Record a new MFS transaction (cash-in, cash-out, send money, etc.)
 */
export async function createMfsTransaction(
  data: CreateMfsTransactionRequest,
): Promise<MfsTransaction> {
  const res = await apiClient.post<MfsTransaction>('/mfs/transactions', data);
  return res.data;
}

/**
 * List MFS transactions with optional filters and pagination
 */
export async function listMfsTransactions(
  params?: MfsTransactionQueryParams,
): Promise<PaginatedResponse<MfsTransaction>> {
  const res = await apiClient.get<PaginatedResponse<MfsTransaction>>('/mfs/transactions', {
    params: buildParams(params as Record<string, string | number | boolean | Date | undefined | null>),
  });
  return res.data;
}

/**
 * Get a single MFS transaction by ID
 */
export async function getMfsTransaction(transactionId: string): Promise<MfsTransaction> {
  const res = await apiClient.get<MfsTransaction>(`/mfs/transactions/${transactionId}`);
  return res.data;
}
