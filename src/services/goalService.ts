import type { CurrencyCode, SavingsGoal } from '../types/models';
import * as storage from '../storage/storage';
import { toMinor, percentOf } from '../utils/money';
import { generateId, nowIso } from '../utils/id';
import { validateTitle, validateAmountMajor, validateDate } from '../utils/validation';

export async function createGoal(input: {
  name: string;
  targetAmountMajor: number;
  currentAmountMajor?: number;
  deadline?: string;
  notes?: string;
  currency?: CurrencyCode;
}): Promise<{ ok: true; goal: SavingsGoal } | { ok: false; error: string }> {
  const titleRes = validateTitle(input.name);
  if (!titleRes.ok) return titleRes;
  const settings = await storage.getSettings();
  const currency = input.currency ?? settings.currency;
  const targetRes = validateAmountMajor(input.targetAmountMajor, currency);
  if (!targetRes.ok) return targetRes;

  let currentMinor = 0;
  if (input.currentAmountMajor !== undefined && input.currentAmountMajor > 0) {
    const curRes = validateAmountMajor(input.currentAmountMajor, currency);
    if (!curRes.ok) return curRes;
    currentMinor = toMinor(curRes.major, currency);
  }

  if (input.deadline) {
    const d = validateDate(input.deadline);
    if (!d.ok) return d;
  }

  const now = nowIso();
  const goal: SavingsGoal = {
    id: generateId('goal'),
    name: titleRes.value,
    targetAmountMinor: toMinor(targetRes.major, currency),
    currentAmountMinor: currentMinor,
    currency,
    deadline: input.deadline,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await storage.saveGoal(goal);
  return { ok: true, goal };
}

export function goalProgress(goal: SavingsGoal): {
  percent: number;
  remainingMinor: number;
  isComplete: boolean;
} {
  const percent = percentOf(goal.currentAmountMinor, goal.targetAmountMinor);
  const remaining = Math.max(0, goal.targetAmountMinor - goal.currentAmountMinor);
  return {
    percent: Math.min(100, percent),
    remainingMinor: remaining,
    isComplete: goal.currentAmountMinor >= goal.targetAmountMinor,
  };
}

/** Rough monthly savings needed to hit deadline */
export function estimatedMonthlySavings(goal: SavingsGoal): number | null {
  if (!goal.deadline) return null;
  const remaining = goal.targetAmountMinor - goal.currentAmountMinor;
  if (remaining <= 0) return 0;
  const now = new Date();
  const end = new Date(goal.deadline + 'T00:00:00');
  const months = Math.max(
    1,
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  );
  return Math.ceil(remaining / months);
}

export async function contributeToGoal(
  goalId: string,
  amountMajor: number
): Promise<{ ok: true; goal: SavingsGoal } | { ok: false; error: string }> {
  const goals = await storage.getAllGoals();
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return { ok: false, error: 'Goal not found' };
  const amountRes = validateAmountMajor(amountMajor, goal.currency);
  if (!amountRes.ok) return amountRes;
  goal.currentAmountMinor += toMinor(amountRes.major, goal.currency);
  goal.updatedAt = nowIso();
  await storage.saveGoal(goal);
  return { ok: true, goal };
}

export async function listGoals() {
  return storage.getAllGoals();
}

export async function deleteGoal(id: string) {
  await storage.deleteGoal(id);
}
