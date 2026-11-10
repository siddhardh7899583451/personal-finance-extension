import type { Budget, BudgetPeriod, CurrencyCode } from '../types/models';
import * as storage from '../storage/storage';
import { toMinor, percentOf, addMinor } from '../utils/money';
import { generateId, nowIso, todayIsoDate } from '../utils/id';
import { validateTitle, validateAmountMajor, validateDate } from '../utils/validation';
import type { Transaction } from '../types/models';

export async function createBudget(input: {
  name: string;
  amountMajor: number;
  period: BudgetPeriod;
  categoryId?: string;
  startDate?: string;
  alertThresholdPercent?: number;
  currency?: CurrencyCode;
}): Promise<{ ok: true; budget: Budget } | { ok: false; error: string }> {
  const titleRes = validateTitle(input.name);
  if (!titleRes.ok) return titleRes;
  const settings = await storage.getSettings();
  const currency = input.currency ?? settings.currency;
  const amountRes = validateAmountMajor(input.amountMajor, currency);
  if (!amountRes.ok) return amountRes;
  const start = input.startDate ?? todayIsoDate();
  const dateRes = validateDate(start);
  if (!dateRes.ok) return dateRes;

  const now = nowIso();
  const budget: Budget = {
    id: generateId('bud'),
    name: titleRes.value,
    amountMinor: toMinor(amountRes.major, currency),
    currency,
    period: input.period,
    categoryId: input.categoryId,
    startDate: dateRes.value,
    alertThresholdPercent: input.alertThresholdPercent ?? 80,
    createdAt: now,
    updatedAt: now,
  };
  await storage.saveBudget(budget);
  return { ok: true, budget };
}

export async function getBudgetUtilization(
  budget: Budget,
  transactions: Transaction[]
): Promise<{ spentMinor: number; remainingMinor: number; utilizationPercent: number }> {
  let spent = 0;
  const relevant = transactions.filter((t) => {
    if (t.type !== 'expense') return false;
    if (t.date < budget.startDate) return false;
    if (budget.endDate && t.date > budget.endDate) return false;
    if (budget.categoryId && t.categoryId !== budget.categoryId) return false;
    return true;
  });
  spent = relevant.reduce((s, t) => addMinor(s, t.amountMinor), 0);
  const remaining = budget.amountMinor - spent;
  return {
    spentMinor: spent,
    remainingMinor: remaining,
    utilizationPercent: percentOf(spent, budget.amountMinor),
  };
}

export async function listBudgets() {
  return storage.getAllBudgets();
}

export async function deleteBudget(id: string) {
  await storage.deleteBudget(id);
}
