/**
 * Reliable monetary arithmetic using integer minor units.
 * Avoids floating-point precision issues common with currency.
 */

import Decimal from 'decimal.js';
import type { CurrencyCode } from '../types/models';

/** Currency minor unit exponents */
const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  AUD: 2,
  CAD: 2,
  SGD: 2,
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
};

export function getDecimals(currency: CurrencyCode): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

export function getSymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/** Convert major units (e.g. 100.50) to minor units (10050) */
export function toMinor(major: number | string, currency: CurrencyCode = 'INR'): number {
  const d = new Decimal(major);
  if (d.isNaN() || !d.isFinite()) {
    throw new Error('Invalid amount');
  }
  const decimals = getDecimals(currency);
  return d.mul(Decimal.pow(10, decimals)).round().toNumber();
}

/** Convert minor units back to major number */
export function toMajor(minor: number, currency: CurrencyCode = 'INR'): number {
  const decimals = getDecimals(currency);
  return new Decimal(minor).div(Decimal.pow(10, decimals)).toNumber();
}

/** Format for display */
export function formatMoney(
  minor: number,
  currency: CurrencyCode = 'INR',
  options: { showSymbol?: boolean; locale?: string } = {}
): string {
  const { showSymbol = true, locale = 'en-IN' } = options;
  const major = toMajor(minor, currency);
  const decimals = getDecimals(currency);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major);
  return showSymbol ? `${getSymbol(currency)}${formatted}` : formatted;
}

/** Safe addition of minor amounts (same currency assumed) */
export function addMinor(...amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + (Number.isFinite(a) ? Math.round(a) : 0), 0);
}

export function subtractMinor(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

export function percentOf(partMinor: number, totalMinor: number): number {
  if (totalMinor === 0) return 0;
  return new Decimal(partMinor).div(totalMinor).mul(100).toDecimalPlaces(2).toNumber();
}

export function isPositive(minor: number): boolean {
  return minor > 0;
}

export function absMinor(minor: number): number {
  return Math.abs(minor);
}
