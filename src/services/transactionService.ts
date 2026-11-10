/**
 * Transaction (Expense / Income) business logic.
 * Separated from storage and UI.
 */

import type {
  CurrencyCode,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types/models';
import * as storage from '../storage/storage';
import { toMinor } from '../utils/money';
import {
  validateTitle,
  validateAmountMajor,
  validateDate,
  validateTags,
  validateNotes,
  validateMerchant,
  validatePaymentMethod,
  validateTransactionType,
} from '../utils/validation';
import { generateId, nowIso, todayIsoDate } from '../utils/id';

export interface CreateTransactionInput {
  type: TransactionType;
  title: string;
  amountMajor: number;
  currency?: CurrencyCode;
  categoryId: string;
  subcategoryId?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  date?: string;
  notes?: string;
  tags?: string[];
  refundOfId?: string;
}

export interface UpdateTransactionInput {
  id: string;
  title?: string;
  amountMajor?: number;
  categoryId?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  date?: string;
  notes?: string;
  tags?: string[];
}

export async function createTransaction(
  input: CreateTransactionInput
): Promise<{ ok: true; transaction: Transaction } | { ok: false; error: string }> {
  if (!validateTransactionType(input.type)) {
    return { ok: false, error: 'Invalid transaction type' };
  }
  const titleRes = validateTitle(input.title);
  if (!titleRes.ok) return titleRes;

  const settings = await storage.getSettings();
  const currency = input.currency ?? settings.currency;

  const amountRes = validateAmountMajor(input.amountMajor, currency);
  if (!amountRes.ok) return amountRes;

  const dateRes = validateDate(input.date ?? todayIsoDate());
  if (!dateRes.ok) return dateRes;

  if (!input.categoryId) return { ok: false, error: 'Category is required' };
  if (!validatePaymentMethod(input.paymentMethod)) {
    return { ok: false, error: 'Invalid payment method' };
  }

  const now = nowIso();
  const tx: Transaction = {
    id: generateId('txn'),
    type: input.type,
    title: titleRes.value,
    amountMinor: toMinor(amountRes.major, currency),
    currency,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    merchant: validateMerchant(input.merchant) || undefined,
    paymentMethod: input.paymentMethod,
    date: dateRes.value,
    notes: validateNotes(input.notes) || undefined,
    tags: validateTags(input.tags),
    refundOfId: input.refundOfId,
    createdAt: now,
    updatedAt: now,
  };

  // Simple duplicate detection: same title, amount, date, category within last 24h lookback is flagged but still allowed
  await storage.saveTransaction(tx);
  return { ok: true, transaction: tx };
}

export async function updateTransaction(
  input: UpdateTransactionInput
): Promise<{ ok: true; transaction: Transaction } | { ok: false; error: string }> {
  const existing = await storage.getTransaction(input.id);
  if (!existing || existing.deletedAt) {
    return { ok: false, error: 'Transaction not found' };
  }

  if (input.title !== undefined) {
    const titleRes = validateTitle(input.title);
    if (!titleRes.ok) return titleRes;
    existing.title = titleRes.value;
  }
  if (input.amountMajor !== undefined) {
    const amountRes = validateAmountMajor(input.amountMajor, existing.currency);
    if (!amountRes.ok) return amountRes;
    existing.amountMinor = toMinor(amountRes.major, existing.currency);
  }
  if (input.categoryId) existing.categoryId = input.categoryId;
  if (input.merchant !== undefined) existing.merchant = validateMerchant(input.merchant) || undefined;
  if (input.paymentMethod !== undefined) {
    if (!validatePaymentMethod(input.paymentMethod)) {
      return { ok: false, error: 'Invalid payment method' };
    }
    existing.paymentMethod = input.paymentMethod;
  }
  if (input.date !== undefined) {
    const dateRes = validateDate(input.date);
    if (!dateRes.ok) return dateRes;
    existing.date = dateRes.value;
  }
  if (input.notes !== undefined) existing.notes = validateNotes(input.notes) || undefined;
  if (input.tags !== undefined) existing.tags = validateTags(input.tags);

  existing.updatedAt = nowIso();
  await storage.saveTransaction(existing);
  return { ok: true, transaction: existing };
}

export async function deleteTransaction(
  id: string,
  hard = false
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await storage.getTransaction(id);
  if (!existing) return { ok: false, error: 'Transaction not found' };
  await storage.deleteTransaction(id, hard);
  return { ok: true };
}

export async function listTransactions(filters?: {
  type?: TransactionType;
  categoryId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  merchant?: string;
}): Promise<Transaction[]> {
  let list = await storage.getAllTransactions();

  if (filters?.type) list = list.filter((t) => t.type === filters.type);
  if (filters?.categoryId) list = list.filter((t) => t.categoryId === filters.categoryId);
  if (filters?.fromDate) list = list.filter((t) => t.date >= filters.fromDate!);
  if (filters?.toDate) list = list.filter((t) => t.date <= filters.toDate!);
  if (filters?.merchant) {
    const m = filters.merchant.toLowerCase();
    list = list.filter((t) => t.merchant?.toLowerCase().includes(m));
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.merchant?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  // Newest first
  list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  return list;
}

/** Detect potential duplicate transactions (same amount, date, similar title) */
export async function findPotentialDuplicates(
  candidate: { title: string; amountMinor: number; date: string; categoryId: string }
): Promise<Transaction[]> {
  const list = await storage.getAllTransactions();
  const titleNorm = candidate.title.toLowerCase().trim();
  return list.filter((t) => {
    if (t.amountMinor !== candidate.amountMinor) return false;
    if (t.date !== candidate.date) return false;
    if (t.categoryId !== candidate.categoryId) return false;
    const existingTitle = t.title.toLowerCase().trim();
    return existingTitle === titleNorm || existingTitle.includes(titleNorm) || titleNorm.includes(existingTitle);
  });
}
