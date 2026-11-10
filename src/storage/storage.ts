/**
 * Local-first storage layer.
 * Uses chrome.storage.local for settings & small data,
 * IndexedDB for large transaction collections.
 * No network calls. All data stays on device.
 */

import type {
  AppSettings,
  Budget,
  Category,
  DATA_VERSION,
  RecurringPayment,
  SavingsGoal,
  Transaction,
} from '../types/models';
import { DEFAULT_CATEGORIES, DATA_VERSION as DV } from '../types/models';
import { generateId, nowIso } from '../utils/id';

const DB_NAME = 'FinanceIntelligenceDB';
const DB_VERSION = 1;
const STORE_TRANSACTIONS = 'transactions';
const STORE_BUDGETS = 'budgets';
const STORE_GOALS = 'savingsGoals';
const STORE_RECURRING = 'recurringPayments';
const STORE_CATEGORIES = 'categories';

const SETTINGS_KEY = 'appSettings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
        const store = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('categoryId', 'categoryId', { unique: false });
        store.createIndex('merchant', 'merchant', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BUDGETS)) {
        db.createObjectStore(STORE_BUDGETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_GOALS)) {
        db.createObjectStore(STORE_GOALS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RECURRING)) {
        db.createObjectStore(STORE_RECURRING, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
      }
    };
  });
}

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbPut<T>(storeName: string, value: T): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function idbDelete(storeName: string, id: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function idbClear(storeName: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

// ---------- Settings (chrome.storage.local) ----------

export async function getSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([SETTINGS_KEY], (result) => {
        if (result[SETTINGS_KEY]) {
          resolve(result[SETTINGS_KEY] as AppSettings);
        } else {
          resolve(createDefaultSettings());
        }
      });
    } else {
      // Fallback for tests / non-extension context
      const raw = localStorage.getItem(SETTINGS_KEY);
      resolve(raw ? (JSON.parse(raw) as AppSettings) : createDefaultSettings());
    }
  });
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  settings.updatedAt = nowIso();
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    } else {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      resolve();
    }
  });
}

function createDefaultSettings(): AppSettings {
  const now = nowIso();
  return {
    version: DV,
    currency: 'INR',
    theme: 'system',
    locale: 'en-IN',
    firstDayOfWeek: 1,
    dateFormat: 'yyyy-MM-dd',
    anomalySensitivity: 'medium',
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- Transactions ----------

export async function getAllTransactions(includeDeleted = false): Promise<Transaction[]> {
  const all = await idbGetAll<Transaction>(STORE_TRANSACTIONS);
  if (includeDeleted) return all;
  return all.filter((t) => !t.deletedAt);
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const all = await idbGetAll<Transaction>(STORE_TRANSACTIONS);
  return all.find((t) => t.id === id);
}

export async function saveTransaction(tx: Transaction): Promise<void> {
  await idbPut(STORE_TRANSACTIONS, tx);
}

export async function deleteTransaction(id: string, hard = false): Promise<void> {
  if (hard) {
    await idbDelete(STORE_TRANSACTIONS, id);
  } else {
    const existing = await getTransaction(id);
    if (existing) {
      existing.deletedAt = nowIso();
      existing.updatedAt = nowIso();
      await idbPut(STORE_TRANSACTIONS, existing);
    }
  }
}

// ---------- Budgets ----------

export async function getAllBudgets(): Promise<Budget[]> {
  return idbGetAll<Budget>(STORE_BUDGETS);
}

export async function saveBudget(budget: Budget): Promise<void> {
  await idbPut(STORE_BUDGETS, budget);
}

export async function deleteBudget(id: string): Promise<void> {
  await idbDelete(STORE_BUDGETS, id);
}

// ---------- Savings Goals ----------

export async function getAllGoals(): Promise<SavingsGoal[]> {
  return idbGetAll<SavingsGoal>(STORE_GOALS);
}

export async function saveGoal(goal: SavingsGoal): Promise<void> {
  await idbPut(STORE_GOALS, goal);
}

export async function deleteGoal(id: string): Promise<void> {
  await idbDelete(STORE_GOALS, id);
}

// ---------- Recurring ----------

export async function getAllRecurring(): Promise<RecurringPayment[]> {
  return idbGetAll<RecurringPayment>(STORE_RECURRING);
}

export async function saveRecurring(item: RecurringPayment): Promise<void> {
  await idbPut(STORE_RECURRING, item);
}

export async function deleteRecurring(id: string): Promise<void> {
  await idbDelete(STORE_RECURRING, id);
}

// ---------- Categories ----------

export async function getAllCategories(): Promise<Category[]> {
  const cats = await idbGetAll<Category>(STORE_CATEGORIES);
  if (cats.length === 0) {
    // Seed defaults
    for (const c of DEFAULT_CATEGORIES) {
      await idbPut(STORE_CATEGORIES, c);
    }
    return [...DEFAULT_CATEGORIES];
  }
  return cats;
}

export async function saveCategory(cat: Category): Promise<void> {
  await idbPut(STORE_CATEGORIES, cat);
}

// ---------- Bulk / Export helpers ----------

export async function replaceAllData(data: {
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  recurringPayments: RecurringPayment[];
  categories: Category[];
}): Promise<void> {
  await idbClear(STORE_TRANSACTIONS);
  await idbClear(STORE_BUDGETS);
  await idbClear(STORE_GOALS);
  await idbClear(STORE_RECURRING);
  await idbClear(STORE_CATEGORIES);
  for (const t of data.transactions) await idbPut(STORE_TRANSACTIONS, t);
  for (const b of data.budgets) await idbPut(STORE_BUDGETS, b);
  for (const g of data.savingsGoals) await idbPut(STORE_GOALS, g);
  for (const r of data.recurringPayments) await idbPut(STORE_RECURRING, r);
  for (const c of data.categories) await idbPut(STORE_CATEGORIES, c);
}

export async function ensureInitialized(): Promise<void> {
  await getSettings();
  await getAllCategories();
}
