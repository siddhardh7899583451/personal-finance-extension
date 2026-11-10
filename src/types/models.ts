/**
 * Core data models for Personal Finance & Expense Intelligence
 * Versioned for migration support.
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'SGD';

export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund';

export type PaymentMethod =
  | 'cash'
  | 'upi'
  | 'card'
  | 'netbanking'
  | 'wallet'
  | 'cheque'
  | 'other';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

/** Amounts stored as integer minor units (paise / cents) to avoid float errors */
export interface Money {
  /** Integer minor units (e.g. 10050 = ₹100.50) */
  amountMinor: number;
  currency: CurrencyCode;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  color?: string;
  type: 'expense' | 'income' | 'both';
  isSystem?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Title / description */
  title: string;
  amountMinor: number;
  currency: CurrencyCode;
  categoryId: string;
  subcategoryId?: string;
  merchant?: string;
  paymentMethod?: PaymentMethod;
  date: string; // ISO YYYY-MM-DD
  notes?: string;
  tags?: string[];
  /** For transfers: linked account or counterpart transaction */
  transferPairId?: string;
  /** Original expense this refunds */
  refundOfId?: string;
  isRecurring?: boolean;
  recurringId?: string;
  createdAt: string; // ISO datetime
  updatedAt: string;
  /** Soft-delete support */
  deletedAt?: string;
}

export interface Budget {
  id: string;
  name: string;
  amountMinor: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  /** null = overall budget */
  categoryId?: string;
  startDate: string;
  endDate?: string;
  alertThresholdPercent: number; // e.g. 80
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmountMinor: number;
  currentAmountMinor: number;
  currency: CurrencyCode;
  deadline?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringPayment {
  id: string;
  title: string;
  amountMinor: number;
  currency: CurrencyCode;
  categoryId: string;
  frequency: RecurrenceFrequency;
  nextDueDate: string;
  paymentMethod?: PaymentMethod;
  merchant?: string;
  notes?: string;
  isActive: boolean;
  lastProcessedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  version: number;
  currency: CurrencyCode;
  theme: 'light' | 'dark' | 'system';
  locale: string;
  firstDayOfWeek: 0 | 1; // 0=Sun, 1=Mon
  dateFormat: string;
  defaultPaymentMethod?: PaymentMethod;
  anomalySensitivity: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface DataSnapshot {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringPayments: RecurringPayment[];
  categories: Category[];
  settings: AppSettings;
}

/** Analytics result shapes */
export interface OverallAnalysis {
  totalExpensesMinor: number;
  totalIncomeMinor: number;
  netCashFlowMinor: number;
  averageDailySpendingMinor: number;
  averageWeeklySpendingMinor: number;
  averageMonthlySpendingMinor: number;
  averageTransactionMinor: number;
  highestExpense: Transaction | null;
  lowestExpense: Transaction | null;
  transactionCount: number;
  savingsRatePercent: number | null;
  periodStart: string;
  periodEnd: string;
  currency: CurrencyCode;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  amountMinor: number;
  percentage: number;
  transactionCount: number;
  budgetUtilizationPercent?: number;
}

export interface Insight {
  id: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  title: string;
  message: string;
  metric?: string;
  relatedCategoryId?: string;
  generatedAt: string;
  /** true when based on limited data */
  isEstimate: boolean;
}

export interface Anomaly {
  id: string;
  type: 'high_amount' | 'category_spike' | 'frequency' | 'duplicate_suspect' | 'merchant_change';
  transactionId?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  detectedAt: string;
}

export const DATA_VERSION = 1;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'expense', icon: '🍽️', color: '#FF6B6B', isSystem: true },
  { id: 'cat-transport', name: 'Transport', type: 'expense', icon: '🚗', color: '#4ECDC4', isSystem: true },
  { id: 'cat-shopping', name: 'Shopping', type: 'expense', icon: '🛍️', color: '#45B7D1', isSystem: true },
  { id: 'cat-bills', name: 'Bills & Utilities', type: 'expense', icon: '📄', color: '#96CEB4', isSystem: true },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'expense', icon: '🎬', color: '#FFEAA7', isSystem: true },
  { id: 'cat-health', name: 'Health', type: 'expense', icon: '💊', color: '#DDA0DD', isSystem: true },
  { id: 'cat-education', name: 'Education', type: 'expense', icon: '📚', color: '#98D8C8', isSystem: true },
  { id: 'cat-travel', name: 'Travel', type: 'expense', icon: '✈️', color: '#F7DC6F', isSystem: true },
  { id: 'cat-subscriptions', name: 'Subscriptions', type: 'expense', icon: '🔄', color: '#BB8FCE', isSystem: true },
  { id: 'cat-other-exp', name: 'Other Expense', type: 'expense', icon: '📦', color: '#AEB6BF', isSystem: true },
  { id: 'cat-salary', name: 'Salary', type: 'income', icon: '💰', color: '#2ECC71', isSystem: true },
  { id: 'cat-freelance', name: 'Freelance', type: 'income', icon: '💻', color: '#27AE60', isSystem: true },
  { id: 'cat-business', name: 'Business', type: 'income', icon: '🏢', color: '#1ABC9C', isSystem: true },
  { id: 'cat-investment', name: 'Investment Returns', type: 'income', icon: '📈', color: '#16A085', isSystem: true },
  { id: 'cat-other-inc', name: 'Other Income', type: 'income', icon: '💵', color: '#58D68D', isSystem: true },
];
