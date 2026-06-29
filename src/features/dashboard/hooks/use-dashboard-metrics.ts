import { useQuery } from '@tanstack/react-query';
import * as SQLite from 'expo-sqlite';
import { apiClient } from '@/lib/api/client';

export interface RecentTransaction {
  id: string;
  invoiceNo: string;
  customerName: string;
  amount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  timestamp: string;
  type: 'sale' | 'due_payment' | 'expense';
}

export interface TopProductItem {
  id: string;
  name: string;
  salesCount: number;
  stockRemaining: number;
  unit: string;
  revenue: number;
}

export interface BusinessInsight {
  id: string;
  type: 'alert' | 'success' | 'info';
  banglaText: string;
  englishText: string;
}

export interface DashboardMetrics {
  todaySalesCents: number;
  todayProfitCents: number;
  todayExpensesCents: number;
  totalDueCents: number;
  lowStockCount: number;
  inventoryValueCents: number;
  salesGrowthPercent: number;
  profitGrowthPercent: number;
  expensesGrowthPercent: number;
  dueGrowthPercent: number;
  inventoryGrowthPercent: number;
  chartData: Array<{ label: string; sales: number; expenses: number }>;
  recentTransactions: RecentTransaction[];
  topProducts: TopProductItem[];
  insights: BusinessInsight[];
}

/**
 * Custom Query Hook fetching SME Business Performance metrics.
 * Computes calculations directly from local SQLite cache if connection state is offline.
 */
export function useDashboardMetrics(isOffline: boolean, timeframe: 'today' | 'seven_days' | 'month' = 'today') {
  const db = SQLite.useSQLiteContext();

  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics', isOffline, timeframe],
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

        // F. Generate dummy 7-day chart data for offline mode
        const chartData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(todayStartTs - (6 - i) * 86400000);
          const label = d.toLocaleDateString('bn-BD', { weekday: 'short' });
          // In offline mode without complex joins, we just mock historical data 
          // or use the 'today' values for the last point
          if (i === 6) {
            return { label, sales: todaySales, expenses: todayExpenses };
          }
          return { label, sales: 0, expenses: 0 };
        });

        return {
          todaySalesCents: todaySales,
          todayProfitCents: todayProfit,
          todayExpensesCents: todayExpenses,
          totalDueCents: totalDue,
          lowStockCount: lowStock,
          inventoryValueCents: 0,
          salesGrowthPercent: 0,
          profitGrowthPercent: 0,
          expensesGrowthPercent: 0,
          dueGrowthPercent: 0,
          inventoryGrowthPercent: 0,
          chartData,
          recentTransactions: [],
          topProducts: [],
          insights: []
        };
      }

      // If online, fetch from the cloud backend reporting endpoints
      const backendTimeframe = timeframe === 'seven_days' ? 'this_week' : timeframe === 'month' ? 'this_month' : 'today';
      const response = await apiClient.get<{ 
        success: boolean; 
        data: {
          timeframe: string;
          kpis: {
            revenue: { current: number; changePercent: number };
            grossProfit: { current: number; changePercent: number };
            expenses: { current: number; changePercent: number };
          };
          revenueTrend: Array<{ date: string; revenueCents: number }>;
          expenseDistribution: Array<{
            categoryName: string;
            amountCents: number;
          }>;
          recent: {
            sales: Array<{
              id: string;
              invoiceNumber: string;
              totalCents: number;
              paymentStatus: string;
              saleDate: string;
              customer?: { name: string } | null;
            }>;
            expenses: Array<{
              id: string;
              title: string;
              amountCents: number;
              expenseDate: string;
              category?: { name: string } | null;
            }>;
          };
        } 
      }>(`/reports/dashboard?timeframe=${backendTimeframe}`);

      const backendData = response.data.data;
      
      const chartData = backendData.revenueTrend.map((point) => ({
        label: new Date(point.date).toLocaleDateString('bn-BD', { weekday: 'short', day: 'numeric' }),
        sales: point.revenueCents,
        expenses: 0
      }));

      const recentTransactions: RecentTransaction[] = [
        ...(backendData.recent?.sales || []).map((sale) => ({
          id: sale.id,
          invoiceNo: sale.invoiceNumber,
          customerName: sale.customer?.name ?? 'ওয়াক-ইন',
          amount: sale.totalCents,
          paymentStatus: sale.paymentStatus === 'PAID' ? 'paid' : sale.paymentStatus === 'PARTIAL' ? 'partial' : 'unpaid' as any,
          timestamp: sale.saleDate,
          type: 'sale' as const,
        })),
        ...(backendData.recent?.expenses || []).map((exp) => ({
          id: exp.id,
          invoiceNo: `EXP-${exp.id.slice(0, 6)}`,
          customerName: exp.category?.name ?? exp.title,
          amount: exp.amountCents,
          paymentStatus: 'paid' as const,
          timestamp: exp.expenseDate,
          type: 'expense' as const,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);

      const insights: BusinessInsight[] = [];
      if (backendData.expenseDistribution?.length > 0) {
        const top = backendData.expenseDistribution[0];
        insights.push({
          id: 'exp-top',
          type: 'info',
          banglaText: `সর্বোচ্চ খরচের বিভাগ: ${top.categoryName} (৳${(top.amountCents / 100).toLocaleString('bn-BD')})`,
          englishText: `Top expense category: ${top.categoryName}`,
        });
      }
      if (backendData.kpis?.grossProfit?.changePercent > 0) {
        insights.push({
          id: 'profit-up',
          type: 'success',
          banglaText: `নীট লাভ ${backendData.kpis.grossProfit.changePercent.toFixed(1)}% বৃদ্ধি পেয়েছে।`,
          englishText: `Net profit up ${backendData.kpis.grossProfit.changePercent.toFixed(1)}%`,
        });
      }

      return {
        todaySalesCents: backendData.kpis.revenue.current,
        todayProfitCents: backendData.kpis.grossProfit.current,
        todayExpensesCents: backendData.kpis.expenses.current,
        totalDueCents: 0,
        lowStockCount: 0,
        inventoryValueCents: 0,
        salesGrowthPercent: backendData.kpis.revenue.changePercent || 0,
        profitGrowthPercent: backendData.kpis.grossProfit.changePercent || 0,
        expensesGrowthPercent: backendData.kpis.expenses.changePercent || 0,
        dueGrowthPercent: 0,
        inventoryGrowthPercent: 0,
        chartData,
        recentTransactions,
        topProducts: [], // Top products not yet in backend dashboard payload or omitted for brevity
        insights
      };
    },
    // Keep caching active to reduce excessive db read operations
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
export default useDashboardMetrics;
