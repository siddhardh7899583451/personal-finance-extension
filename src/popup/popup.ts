/**
 * Popup – quick expense / income entry + summary.
 */

import * as storage from '../storage/storage';
import { createTransaction, listTransactions } from '../services/transactionService';
import { formatMoney } from '../utils/money';
import {
  computeOverallAnalysis,
  currentMonthRange,
} from '../analytics/analyticsEngine';
import { todayIsoDate } from '../utils/id';
import type { Category, TransactionType } from '../types/models';

let currentType: TransactionType = 'expense';
let categories: Category[] = [];

async function init() {
  await storage.ensureInitialized();
  categories = await storage.getAllCategories();
  applyTheme();
  bindUI();
  fillCategories();
  setDefaultDate();
  await refreshSummary();
  await refreshRecent();
}

function applyTheme() {
  storage.getSettings().then((s) => {
    const theme =
      s.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : s.theme;
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  });
}

function bindUI() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = (btn as HTMLElement).dataset.type as TransactionType;
      (document.getElementById('submitBtn') as HTMLButtonElement).textContent =
        currentType === 'expense' ? 'Add Expense' : 'Add Income';
      fillCategories();
    });
  });

  document.getElementById('quickForm')?.addEventListener('submit', onSubmit);
  document.getElementById('btnDashboard')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
  document.getElementById('btnTheme')?.addEventListener('click', async () => {
    const s = await storage.getSettings();
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    await storage.saveSettings(s);
    applyTheme();
  });
}

function fillCategories() {
  const sel = document.getElementById('category') as HTMLSelectElement;
  const filtered = categories.filter(
    (c) => c.type === currentType || c.type === 'both'
  );
  sel.innerHTML = filtered
    .map((c) => `<option value="${c.id}">${c.icon ?? ''} ${c.name}</option>`)
    .join('');
}

function setDefaultDate() {
  (document.getElementById('date') as HTMLInputElement).value = todayIsoDate();
}

function showMsg(text: string, ok: boolean) {
  const el = document.getElementById('formMsg')!;
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  if (ok) setTimeout(() => (el.textContent = ''), 2500);
}

async function onSubmit(e: Event) {
  e.preventDefault();
  const title = (document.getElementById('title') as HTMLInputElement).value;
  const amount = parseFloat((document.getElementById('amount') as HTMLInputElement).value);
  const categoryId = (document.getElementById('category') as HTMLSelectElement).value;
  const date = (document.getElementById('date') as HTMLInputElement).value;
  const paymentMethod = (document.getElementById('paymentMethod') as HTMLSelectElement).value || undefined;

  const result = await createTransaction({
    type: currentType,
    title,
    amountMajor: amount,
    categoryId,
    date,
    paymentMethod: paymentMethod as any,
  });

  if (!result.ok) {
    showMsg(result.error, false);
    return;
  }

  showMsg('Saved', true);
  (document.getElementById('quickForm') as HTMLFormElement).reset();
  setDefaultDate();
  fillCategories();
  await refreshSummary();
  await refreshRecent();
}

async function refreshSummary() {
  const settings = await storage.getSettings();
  const txns = await storage.getAllTransactions();
  const range = currentMonthRange();
  const analysis = computeOverallAnalysis(txns, range, settings.currency);

  document.getElementById('monthSpent')!.textContent = formatMoney(
    analysis.totalExpensesMinor,
    settings.currency
  );
  document.getElementById('monthIncome')!.textContent = formatMoney(
    analysis.totalIncomeMinor,
    settings.currency
  );
  const netEl = document.getElementById('monthNet')!;
  netEl.textContent = formatMoney(analysis.netCashFlowMinor, settings.currency);
  netEl.style.color = analysis.netCashFlowMinor >= 0 ? 'var(--success)' : 'var(--danger)';
}

async function refreshRecent() {
  const list = await listTransactions();
  const recent = list.slice(0, 6);
  const ul = document.getElementById('recentList')!;
  const empty = document.getElementById('recentEmpty')!;
  if (recent.length === 0) {
    ul.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const settings = await storage.getSettings();
  ul.innerHTML = recent
    .map(
      (t) => `
    <li class="txn-item">
      <div>
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="meta">${t.date}</div>
      </div>
      <div class="amount ${t.type}">${t.type === 'expense' ? '−' : '+'}${formatMoney(t.amountMinor, settings.currency)}</div>
    </li>`
    )
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init().catch(console.error);
