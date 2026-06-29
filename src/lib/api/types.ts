// =============================================================================
// BizOS API SDK — Shared Types
// =============================================================================

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  limit: number;
  cursor?: string;
  nextCursor?: string | null;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, string[]>;

  constructor(message: string, status: number, code?: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True for 4xx validation / business logic errors */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** True for 5xx server-side errors */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** True for 401 Unauthorized */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True for 403 Forbidden */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** True for 404 Not Found */
  get isNotFound(): boolean {
    return this.status === 404;
  }
}

// ─── Shared Enums ────────────────────────────────────────────────────────────

export type PaymentMethod =
  | 'CASH'
  | 'BKASH'
  | 'NAGAD'
  | 'ROCKET'
  | 'BANK'
  | 'CARD'
  | 'CHECK'
  | 'OTHER';

export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'RETURNED' | 'VOID';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

// ─── Generic API Response Wrapper ────────────────────────────────────────────

/** Backend success envelope: { success: true, data: T, meta?: ... } */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Backend error envelope: { success: false, error: { message, code?, details? } } */
export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorBody;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
