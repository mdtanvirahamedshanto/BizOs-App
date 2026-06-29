import { apiClient, idempotent } from '../client';
import * as SQLite from 'expo-sqlite';
import { newId } from '@/lib/id';

export interface ExpenseInput {
  id: string; // Client-side generated UUID
  categoryId?: string;
  title: string;
  description?: string;
  amountCents: number;
  paymentMethod: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  categoryId?: string;
  title: string;
  description?: string;
  amountCents: number;
  paymentMethod: string;
  isSynced: number;
  createdAt: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  lastUpdated: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BackendExpensePayload {
  categoryId?: string;
  expenseDate?: string;
  title: string;
  description?: string;
  amountCents: number;
  paymentMethod: string;
}

export function toBackendExpensePayload(input: ExpenseInput): BackendExpensePayload {
  const payload: BackendExpensePayload = {
    expenseDate: new Date(input.createdAt).toISOString(),
    title: input.title,
    description: input.description,
    amountCents: input.amountCents,
    paymentMethod: input.paymentMethod,
  };

  if (input.categoryId && UUID_RE.test(input.categoryId)) {
    payload.categoryId = input.categoryId;
  }

  return payload;
}

export const expensesApi = {
  createExpense: async (
    db: SQLite.SQLiteDatabase,
    input: ExpenseInput,
    isOffline: boolean
  ): Promise<{ success: boolean; offline: boolean }> => {
    try {
      await db.runAsync(
        `INSERT INTO expenses (id, categoryId, title, description, amountCents, paymentMethod, isSynced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.categoryId || null,
          input.title,
          input.description || null,
          input.amountCents,
          input.paymentMethod,
          isOffline ? 0 : 1,
          input.createdAt,
        ]
      );

      if (isOffline) {
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CREATE_EXPENSE',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }

      try {
        await apiClient.post('/expenses', toBackendExpensePayload(input), idempotent(input.id));
        return { success: true, offline: false };
      } catch (err) {
        await db.runAsync('UPDATE expenses SET isSynced = 0 WHERE id = ?', [input.id]);
        await db.runAsync(
          `INSERT INTO sync_outbox (id, eventType, payload, isProcessing, createdAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            input.id,
            'CREATE_EXPENSE',
            JSON.stringify(input),
            0,
            Date.now(),
          ]
        );
        return { success: true, offline: true };
      }
    } catch (dbError) {
      console.error('[ExpensesAPI] Local db transaction failure:', dbError);
      throw dbError;
    }
  },

  listExpenses: async (params?: { limit?: number; cursor?: string }): Promise<{ success: boolean; data: Expense[] }> => {
    const response = await apiClient.get<{ success: boolean; data: Expense[] }>('/expenses', { params });
    return response.data;
  },

  listCategories: async (db: SQLite.SQLiteDatabase): Promise<ExpenseCategory[]> => {
    return db.getAllAsync<ExpenseCategory>('SELECT * FROM expense_categories ORDER BY name ASC');
  },
};
export default expensesApi;
