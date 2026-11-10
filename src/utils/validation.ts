/**
 * Input validation and sanitization.
 * Protects against XSS, formula injection, and invalid financial data.
 */

import type { CurrencyCode, PaymentMethod, TransactionType } from '../types/models';

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 20;
const MAX_MERCHANT_LENGTH = 120;

const VALID_CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD'];
const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'cash', 'upi', 'card', 'netbanking', 'wallet', 'cheque', 'other',
];
const VALID_TYPES: TransactionType[] = ['expense', 'income', 'transfer', 'refund'];

export function sanitizeString(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  // Strip control characters and normalize whitespace
  let s = input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Prevent CSV formula injection when exporting */
export function escapeCsvCell(value: string): string {
  const s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s) || s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function validateTitle(title: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const s = sanitizeString(title, MAX_TITLE_LENGTH);
  if (!s) return { ok: false, error: 'Title is required' };
  return { ok: true, value: s };
}

export function validateAmountMajor(
  amount: unknown,
  currency: CurrencyCode = 'INR'
): { ok: true; major: number } | { ok: false; error: string } {
  const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(n)) return { ok: false, error: 'Amount must be a valid number' };
  if (n <= 0) return { ok: false, error: 'Amount must be greater than zero' };
  // Reasonable upper bound to catch fat-finger errors (100 crore)
  if (n > 1_000_000_000) return { ok: false, error: 'Amount is unrealistically large' };
  return { ok: true, major: n };
}

export function validateDate(dateStr: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof dateStr !== 'string' || !dateStr.trim()) {
    return { ok: false, error: 'Date is required' };
  }
  const s = dateStr.trim();
  // Strict YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { ok: false, error: 'Date must be YYYY-MM-DD' };
  }
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' };
  // Reject far future / past (data integrity)
  const year = d.getFullYear();
  if (year < 2000 || year > 2100) return { ok: false, error: 'Date year out of supported range' };
  return { ok: true, value: s };
}

export function validateCurrency(c: unknown): c is CurrencyCode {
  return typeof c === 'string' && VALID_CURRENCIES.includes(c as CurrencyCode);
}

export function validatePaymentMethod(m: unknown): m is PaymentMethod | undefined {
  if (m === undefined || m === null || m === '') return true;
  return typeof m === 'string' && VALID_PAYMENT_METHODS.includes(m as PaymentMethod);
}

export function validateTransactionType(t: unknown): t is TransactionType {
  return typeof t === 'string' && VALID_TYPES.includes(t as TransactionType);
}

export function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => sanitizeString(t, MAX_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

export function validateNotes(notes: unknown): string {
  return sanitizeString(notes, MAX_NOTES_LENGTH);
}

export function validateMerchant(merchant: unknown): string {
  return sanitizeString(merchant, MAX_MERCHANT_LENGTH);
}

/** Basic UUID v4-ish check */
export function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 8 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}
