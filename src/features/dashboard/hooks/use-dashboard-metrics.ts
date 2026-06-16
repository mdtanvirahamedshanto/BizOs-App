import { useQuery } from '@tanstack/react-query';
import * as SQLite from 'expo-sqlite';
import { apiClient } from '@/lib/api/client';

export interface DashboardMetrics {
  todaySalesCents: number;
  todayProfitCents: number;
  todayExpensesCents: number;
  totalDueCents: number;
  lowStockCount: number;
}

/**
 * Custom Query Hook fetching SME Business Performance metrics.
 * Computes calculations directly from local SQLite cache if connection state is offline.
 */
export function useDashboardMetrics(isOffline: boolean) {
  const db = SQLite.useSQLiteContext();

  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics', isOffline],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (isOffline) {
        console.log('[DashboardHook] Device is offline. Querying SQLite database for local aggregates.');

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartTs = todayStart.getTime();

        // A. Sum today's cash sales
        const salesRow = await db.getFirstAsync<{ sum: number | null }>(
          'SELECT SUM(totalCents) as sum FROM sales WHERE createdAt >= ?',
          [todayStartTs]
        );
        const todaySales = salesRow?.sum ?? 0;

        // B. Sum today's cash outflow entries
        const expenseRow = await db.getFirstAsync<{ sum: number | null }>(
          "SELECT SUM(amountCents) as sum FROM cashbook_entries WHERE type = 'OUT' AND createdAt >= ?",
          [todayStartTs]
        );
        const todayExpenses = expenseRow?.sum ?? 0;

        // C. Sum current customer debt
        const dueRow = await db.getFirstAsync<{ sum: number | null }>(
          'SELECT SUM(dueCents) as sum FROM customers WHERE dueCents > 0'
        );
        const totalDue = dueRow?.sum ?? 0;

        // D. Calculate low stock alerts (items where stock is below threshold)
        const stockRow = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM products WHERE stock < 10'
        );
        const lowStock = stockRow?.count ?? 0;

        // E. Estimate profit locally (mocking standard retail net profit margin)
        const todayProfit = Math.round(todaySales * 0.18);

        return {
          todaySalesCents: todaySales,
          todayProfitCents: todayProfit,
          todayExpensesCents: todayExpenses,
          totalDueCents: totalDue,
          lowStockCount: lowStock,
        };
      }

      // If online, fetch from the cloud backend reporting endpoints
      const response = await apiClient.get<{ success: boolean; data: DashboardMetrics }>('/reports/dashboard-metrics');
      return response.data.data;
    },
    // Keep caching active to reduce excessive db read operations
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
export default useDashboardMetrics;
