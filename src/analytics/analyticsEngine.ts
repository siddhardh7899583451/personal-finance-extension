/**
 * Independent financial analytics engine.
 * All calculations use stored transaction data.
 * Insights are data-backed; estimates are clearly marked.
 */

import type {
  Anomaly,
  Category,
  CategorySpending,
  CurrencyCode,
  Insight,
  OverallAnalysis,
  Transaction,
} from '../types/models';
import { addMinor, percentOf, formatMoney } from '../utils/money';
import { generateId, nowIso } from '../utils/id';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

function filterByRange(txns: Transaction[], range?: DateRange): Transaction[] {
  if (!range) return txns;
  return txns.filter((t) => t.date >= range.start && t.date <= range.end);
}

function expensesOnly(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.type === 'expense');
}

function incomeOnly(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.type === 'income');
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start + 'T00:00:00');
  const b = new Date(end + 'T00:00:00');
  const diff = Math.abs(b.getTime() - a.getTime());
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

export function computeOverallAnalysis(
  allTxns: Transaction[],
  range: DateRange,
  currency: CurrencyCode
): OverallAnalysis {
  const txns = filterByRange(allTxns, range);
  const expenses = expensesOnly(txns);
  const incomes = incomeOnly(txns);

  const totalExpensesMinor = expenses.reduce((s, t) => addMinor(s, t.amountMinor), 0);
  const totalIncomeMinor = incomes.reduce((s, t) => addMinor(s, t.amountMinor), 0);
  const netCashFlowMinor = totalIncomeMinor - totalExpensesMinor;

  const dayCount = daysBetween(range.start, range.end);
  const weekCount = dayCount / 7;
  const monthCount = dayCount / 30.44; // average month length

  const avgDaily = Math.round(totalExpensesMinor / dayCount);
  const avgWeekly = Math.round(totalExpensesMinor / Math.max(weekCount, 1));
  const avgMonthly = Math.round(totalExpensesMinor / Math.max(monthCount, 1));
  const avgTxn =
    expenses.length > 0 ? Math.round(totalExpensesMinor / expenses.length) : 0;

  let highest: Transaction | null = null;
  let lowest: Transaction | null = null;
  for (const e of expenses) {
    if (!highest || e.amountMinor > highest.amountMinor) highest = e;
    if (!lowest || e.amountMinor < lowest.amountMinor) lowest = e;
  }

  let savingsRatePercent: number | null = null;
  if (totalIncomeMinor > 0) {
    savingsRatePercent = percentOf(netCashFlowMinor, totalIncomeMinor);
  }

  return {
    totalExpensesMinor,
    totalIncomeMinor,
    netCashFlowMinor,
    averageDailySpendingMinor: avgDaily,
    averageWeeklySpendingMinor: avgWeekly,
    averageMonthlySpendingMinor: avgMonthly,
    averageTransactionMinor: avgTxn,
    highestExpense: highest,
    lowestExpense: lowest,
    transactionCount: expenses.length,
    savingsRatePercent,
    periodStart: range.start,
    periodEnd: range.end,
    currency,
  };
}

export function computeCategorySpending(
  allTxns: Transaction[],
  categories: Category[],
  range: DateRange
): CategorySpending[] {
  const expenses = expensesOnly(filterByRange(allTxns, range));
  const total = expenses.reduce((s, t) => addMinor(s, t.amountMinor), 0);
  const map = new Map<string, { amount: number; count: number }>();

  for (const e of expenses) {
    const entry = map.get(e.categoryId) ?? { amount: 0, count: 0 };
    entry.amount = addMinor(entry.amount, e.amountMinor);
    entry.count += 1;
    map.set(e.categoryId, entry);
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unknown';

  const result: CategorySpending[] = [];
  for (const [categoryId, { amount, count }] of map) {
    result.push({
      categoryId,
      categoryName: catName(categoryId),
      amountMinor: amount,
      percentage: percentOf(amount, total),
      transactionCount: count,
    });
  }
  result.sort((a, b) => b.amountMinor - a.amountMinor);
  return result;
}

export function computePeriodComparison(
  allTxns: Transaction[],
  current: DateRange,
  previous: DateRange,
  currency: CurrencyCode
): {
  current: OverallAnalysis;
  previous: OverallAnalysis;
  expenseChangePercent: number | null;
  incomeChangePercent: number | null;
} {
  const cur = computeOverallAnalysis(allTxns, current, currency);
  const prev = computeOverallAnalysis(allTxns, previous, currency);

  const expenseChangePercent =
    prev.totalExpensesMinor === 0
      ? null
      : percentOf(cur.totalExpensesMinor - prev.totalExpensesMinor, prev.totalExpensesMinor);
  const incomeChangePercent =
    prev.totalIncomeMinor === 0
      ? null
      : percentOf(cur.totalIncomeMinor - prev.totalIncomeMinor, prev.totalIncomeMinor);

  return { current: cur, previous: prev, expenseChangePercent, incomeChangePercent };
}

export function detectAnomalies(
  allTxns: Transaction[],
  range: DateRange,
  sensitivity: 'low' | 'medium' | 'high' = 'medium'
): Anomaly[] {
  const expenses = expensesOnly(filterByRange(allTxns, range));
  if (expenses.length < 5) return []; // insufficient data

  const amounts = expenses.map((e) => e.amountMinor).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)];
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  // Simple robust threshold using median absolute deviation approximation
  const multipliers = { low: 4, medium: 3, high: 2.2 };
  const mult = multipliers[sensitivity];
  const threshold = Math.max(median * mult, mean * 2.5);

  const anomalies: Anomaly[] = [];
  const now = nowIso();

  for (const e of expenses) {
    if (e.amountMinor >= threshold && e.amountMinor > median * 2) {
      anomalies.push({
        id: generateId('anom'),
        type: 'high_amount',
        transactionId: e.id,
        message: `Unusually high expense: ${e.title}`,
        severity: e.amountMinor > threshold * 1.5 ? 'high' : 'medium',
        explanation: `Amount is significantly above typical spending (median ≈ ${formatMoney(median, e.currency)}). This is statistical, not a fraud label.`,
        detectedAt: now,
      });
    }
  }

  // Frequency: same merchant many times in short period
  const merchantCounts = new Map<string, Transaction[]>();
  for (const e of expenses) {
    if (!e.merchant) continue;
    const key = e.merchant.toLowerCase();
    const list = merchantCounts.get(key) ?? [];
    list.push(e);
    merchantCounts.set(key, list);
  }
  for (const [merchant, list] of merchantCounts) {
    if (list.length >= 8) {
      anomalies.push({
        id: generateId('anom'),
        type: 'frequency',
        message: `Frequent purchases at "${merchant}" (${list.length} times in period)`,
        severity: 'low',
        explanation: 'Repeated small or regular purchases at the same merchant. Review if intentional.',
        detectedAt: now,
      });
    }
  }

  // Simple duplicate suspects (same amount + same day + similar title)
  const seen = new Map<string, Transaction>();
  for (const e of expenses) {
    const key = `${e.date}|${e.amountMinor}|${e.title.toLowerCase().slice(0, 20)}`;
    if (seen.has(key)) {
      anomalies.push({
        id: generateId('anom'),
        type: 'duplicate_suspect',
        transactionId: e.id,
        message: `Possible duplicate: ${e.title} on ${e.date}`,
        severity: 'medium',
        explanation: 'Another transaction with matching date, amount and similar title exists.',
        detectedAt: now,
      });
    } else {
      seen.set(key, e);
    }
  }

  return anomalies.slice(0, 20); // cap
}

export function generateInsights(
  allTxns: Transaction[],
  categories: Category[],
  currentRange: DateRange,
  previousRange: DateRange | null,
  currency: CurrencyCode,
  overall: OverallAnalysis
): Insight[] {
  const insights: Insight[] = [];
  const now = nowIso();
  const categorySpend = computeCategorySpending(allTxns, categories, currentRange);

  // Highest category
  if (categorySpend.length > 0) {
    const top = categorySpend[0];
    insights.push({
      id: generateId('ins'),
      type: 'info',
      title: 'Top spending category',
      message: `${top.categoryName} accounts for ${top.percentage.toFixed(1)}% of expenses (${formatMoney(top.amountMinor, currency)}).`,
      relatedCategoryId: top.categoryId,
      generatedAt: now,
      isEstimate: false,
    });
  }

  // Period comparison
  if (previousRange) {
    const cmp = computePeriodComparison(allTxns, currentRange, previousRange, currency);
    if (cmp.expenseChangePercent !== null) {
      const abs = Math.abs(cmp.expenseChangePercent);
      if (abs >= 5) {
        const direction = cmp.expenseChangePercent > 0 ? 'increased' : 'decreased';
        insights.push({
          id: generateId('ins'),
          type: cmp.expenseChangePercent > 15 ? 'warning' : 'info',
          title: 'Spending change vs previous period',
          message: `Total expenses ${direction} by ${abs.toFixed(1)}% compared with the previous period.`,
          metric: `${cmp.expenseChangePercent > 0 ? '+' : ''}${cmp.expenseChangePercent.toFixed(1)}%`,
          generatedAt: now,
          isEstimate: false,
        });
      }
    }
  }

  // Savings rate
  if (overall.savingsRatePercent !== null) {
    const rate = overall.savingsRatePercent;
    insights.push({
      id: generateId('ins'),
      type: rate >= 20 ? 'success' : rate < 0 ? 'alert' : 'info',
      title: 'Savings rate',
      message:
        rate >= 0
          ? `You saved ${rate.toFixed(1)}% of income in this period.`
          : `Expenses exceeded income by ${Math.abs(rate).toFixed(1)}% of income.`,
      metric: `${rate.toFixed(1)}%`,
      generatedAt: now,
      isEstimate: false,
    });
  } else if (overall.totalIncomeMinor === 0 && overall.totalExpensesMinor > 0) {
    insights.push({
      id: generateId('ins'),
      type: 'info',
      title: 'No income recorded',
      message: 'Add income entries to calculate savings rate and cash-flow insights.',
      generatedAt: now,
      isEstimate: true,
    });
  }

  // Weekday vs weekend (if enough data)
  const expenses = expensesOnly(filterByRange(allTxns, currentRange));
  if (expenses.length >= 10) {
    let weekday = 0;
    let weekend = 0;
    let wdCount = 0;
    let weCount = 0;
    for (const e of expenses) {
      const day = new Date(e.date + 'T00:00:00').getDay();
      if (day === 0 || day === 6) {
        weekend += e.amountMinor;
        weCount++;
      } else {
        weekday += e.amountMinor;
        wdCount++;
      }
    }
    if (wdCount > 0 && weCount > 0) {
      const avgWd = weekday / wdCount;
      const avgWe = weekend / weCount;
      if (avgWe > avgWd * 1.25) {
        insights.push({
          id: generateId('ins'),
          type: 'info',
          title: 'Weekend spending',
          message: `Average weekend transaction is higher than weekday spending. Consider reviewing weekend habits.`,
          generatedAt: now,
          isEstimate: false,
        });
      }
    }
  }

  if (expenses.length < 5) {
    insights.push({
      id: generateId('ins'),
      type: 'info',
      title: 'Limited data',
      message: 'Add more transactions for richer insights and anomaly detection.',
      generatedAt: now,
      isEstimate: true,
    });
  }

  return insights;
}

/** Helper: previous calendar month range */
export function previousMonthRange(from: Date = new Date()): DateRange {
  const y = from.getFullYear();
  const m = from.getMonth(); // 0-based
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // last day of previous month
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function currentMonthRange(from: Date = new Date()): DateRange {
  const y = from.getFullYear();
  const m = from.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
