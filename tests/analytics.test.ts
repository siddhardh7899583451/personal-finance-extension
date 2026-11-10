import { describe, it, expect } from 'vitest';
import {
  computeOverallAnalysis,
  computeCategorySpending,
  detectAnomalies,
} from '../src/analytics/analyticsEngine';
import type { Transaction, Category } from '../src/types/models';

const cats: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense' },
  { id: 'cat-salary', name: 'Salary', type: 'income' },
];

function txn(partial: Partial<Transaction> & { id: string; type: Transaction['type']; amountMinor: number; date: string }): Transaction {
  return {
    title: 't',
    currency: 'INR',
    categoryId: 'cat-food',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('analytics engine', () => {
  const range = { start: '2026-01-01', end: '2026-01-31' };

  it('computes overall analysis', () => {
    const txns = [
      txn({ id: '1', type: 'expense', amountMinor: 50000, date: '2026-01-10' }),
      txn({ id: '2', type: 'income', amountMinor: 200000, date: '2026-01-05', categoryId: 'cat-salary' }),
    ];
    const a = computeOverallAnalysis(txns, range, 'INR');
    expect(a.totalExpensesMinor).toBe(50000);
    expect(a.totalIncomeMinor).toBe(200000);
    expect(a.netCashFlowMinor).toBe(150000);
    expect(a.savingsRatePercent).toBe(75);
  });

  it('category spending percentages', () => {
    const txns = [
      txn({ id: '1', type: 'expense', amountMinor: 30000, date: '2026-01-10' }),
      txn({ id: '2', type: 'expense', amountMinor: 70000, date: '2026-01-11', categoryId: 'cat-food' }),
    ];
    const c = computeCategorySpending(txns, cats, range);
    expect(c[0].percentage).toBe(100);
  });

  it('returns no anomalies with sparse data', () => {
    const txns = [txn({ id: '1', type: 'expense', amountMinor: 100, date: '2026-01-10' })];
    expect(detectAnomalies(txns, range)).toEqual([]);
  });
});
