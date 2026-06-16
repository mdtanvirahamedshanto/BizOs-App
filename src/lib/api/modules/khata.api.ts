import { apiClient } from '../client';

export interface KhataAccount {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  balanceCents: number; // positive = customer owes due, negative = advance/credit
  lastTransactionAt?: number;
}

export interface CollectionInput {
  accountId: string;
  amountCents: number;
  paymentMethod: 'CASH' | 'MFS' | 'BANK';
  reference?: string;
}

export const khataApi = {
  /**
   * Fetches customer ledger accounts lists.
   */
  listAccounts: async (params?: { search?: string }): Promise<{ success: boolean; data: KhataAccount[] }> => {
    const response = await apiClient.get<{ success: boolean; data: KhataAccount[] }>('/khata/accounts', { params });
    return response.data;
  },

  /**
   * Records a due collection payment received from a customer.
   */
  recordCollection: async (input: CollectionInput): Promise<{ success: boolean; data: any }> => {
    const response = await apiClient.post<{ success: boolean; data: any }>('/khata/collection', input);
    return response.data;
  },
};
export default khataApi;
