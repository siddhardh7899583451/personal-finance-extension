/**
 * Full financial dashboard controller.
 */

import * as storage from '../storage/storage';
import { listTransactions, createTransaction, deleteTransaction } from '../services/transactionService';
import { listBudgets, createBudget, getBudgetUtilization, deleteBudget } from '../services/budgetService';
import { listGoals, createGoal, goalProgress, contributeToGoal, deleteGoal } from '../services/goalService';
import { formatMoney } from '../utils/money';
import {
  computeOverallAnalysis,
  computeCategorySpending,
  detectAnomalies,
  generateInsights,
  currentMonthRange,
  previousMonthRange,
  type DateRange,
} from '../analytics/analyticsEngine';
import { escapeCsvCell } from '../utils/validation';
import type { Category, Transaction, TransactionType } from '../types/models';
import { todayIsoDate } from '../utils/id';
import {
  Chart,
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
} from 'chart.js';

Chart.register(
  DoughnutController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip
);

let categories: Category[] = [];
let categoryChart: Chart | null = null;
let trendChart: Chart | null = null;
let pendingImport: any = null;

async function init() {
  await storage.ensureInitialized();
  categories = await storage.getAllCategories();
  applyTheme();
  bindNav();
  bindActions();
  await loadSettingsForm();
  await refreshAll();
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

function bindNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const view = (btn as HTMLElement).dataset.view!;
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      document.getElementById(`view-${view}`)?.classList.add('active');
      document.getElementById('viewTitle')!.textContent =
        (btn as HTMLElement).textContent?.trim() || view;
      if (view === 'transactions') renderTransactions();
      if (view === 'budgets') renderBudgets();
      if (view === 'goals') renderGoals();
      if (view === 'insights') renderInsights();
    });
  });
}

function bindActions() {
  document.getElementById('periodSelect')?.addEventListener('change', () => refreshOverview());
  document.getElementById('btnTheme')?.addEventListener('click', async () => {
    const s = await storage.getSettings();
    s.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    await storage.saveSettings(s);
    applyTheme();
  });
  document.getElementById('btnAddTxn')?.addEventListener('click', () => openAddTxnModal());
  document.getElementById('btnAddBudget')?.addEventListener('click', () => openAddBudgetModal());
  document.getElementById('btnAddGoal')?.addEventListener('click', () => openAddGoalModal());
  document.getElementById('searchTxn')?.addEventListener('input', () => renderTransactions());
  document.getElementById('filterType')?.addEventListener('change', () => renderTransactions());
  document.getElementById('btnExportJson')?.addEventListener('click', exportJson);
  document.getElementById('btnExportCsv')?.addEventListener('click', exportCsv);
  document.getElementById('importFile')?.addEventListener('change', onImportFile);
  document.getElementById('btnImportApply')?.addEventListener('click', applyImport);
  document.getElementById('btnSaveSettings')?.addEventListener('click', saveSettings);
  document.getElementById('modalCancel')?.addEventListener('click', () => {
    (document.getElementById('modal') as HTMLDialogElement).close();
  });
}

function getSelectedRange(): DateRange {
  const val = (document.getElementById('periodSelect') as HTMLSelectElement).value;
  const now = new Date();
  if (val === 'this-month') return currentMonthRange(now);
  if (val === 'last-month') return previousMonthRange(now);
  if (val === 'this-year') {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
  return { start: '2000-01-01', end: '2100-12-31' };
}

async function refreshAll() {
  await refreshOverview();
  await renderTransactions();
  await renderBudgets();
  await renderGoals();
  await renderInsights();
}

async function refreshOverview() {
  const settings = await storage.getSettings();
  const txns = await storage.getAllTransactions();
  const range = getSelectedRange();
  const analysis = computeOverallAnalysis(txns, range, settings.currency);
  const catSpend = computeCategorySpending(txns, categories, range);
  const prev = previousMonthRange();
  const insights = generateInsights(txns, categories, range, prev, settings.currency, analysis);

  document.getElementById('kpiExpenses')!.textContent = formatMoney(analysis.totalExpensesMinor, settings.currency);
  document.getElementById('kpiIncome')!.textContent = formatMoney(analysis.totalIncomeMinor, settings.currency);
  document.getElementById('kpiNet')!.textContent = formatMoney(analysis.netCashFlowMinor, settings.currency);
  document.getElementById('kpiSavings')!.textContent =
    analysis.savingsRatePercent !== null ? `${analysis.savingsRatePercent.toFixed(1)}%` : 'N/A';
  document.getElementById('kpiDaily')!.textContent = formatMoney(analysis.averageDailySpendingMinor, settings.currency);
  document.getElementById('kpiCount')!.textContent = String(analysis.transactionCount);

  // Category donut
  const ctx1 = (document.getElementById('chartCategory') as HTMLCanvasElement)?.getContext('2d');
  if (ctx1) {
    categoryChart?.destroy();
    categoryChart = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: catSpend.map((c) => c.categoryName),
        datasets: [{
          data: catSpend.map((c) => c.amountMinor / 100),
          backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'],
        }],
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#ccc' } } },
      },
    });
  }

  // Daily trend
  const dayMap = new Map<string, number>();
  txns
    .filter((t) => t.type === 'expense' && t.date >= range.start && t.date <= range.end)
    .forEach((t) => dayMap.set(t.date, (dayMap.get(t.date) || 0) + t.amountMinor));
  const days = [...dayMap.keys()].sort();
  const ctx2 = (document.getElementById('chartTrend') as HTMLCanvasElement)?.getContext('2d');
  if (ctx2) {
    trendChart?.destroy();
    trendChart = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Expenses',
          data: days.map((d) => (dayMap.get(d) || 0) / 100),
          borderColor: '#3b82f6',
          tension: 0.3,
          fill: true,
          backgroundColor: 'rgba(59,130,246,0.15)',
        }],
      },
      options: {
        scales: {
          x: { ticks: { color: '#8b9bb4' }, grid: { color: '#2a3544' } },
          y: { ticks: { color: '#8b9bb4' }, grid: { color: '#2a3544' } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  const list = document.getElementById('insightList')!;
  list.innerHTML = insights
    .slice(0, 5)
    .map(
      (i) =>
        `<li class="${i.type}"><strong>${escapeHtml(i.title)}</strong><br/>${escapeHtml(i.message)}${i.isEstimate ? ' <em>(estimate)</em>' : ''}</li>`
    )
    .join('') || '<li>No insights yet — add more transactions.</li>';
}

async function renderTransactions() {
  const settings = await storage.getSettings();
  const search = (document.getElementById('searchTxn') as HTMLInputElement)?.value || '';
  const type = (document.getElementById('filterType') as HTMLSelectElement)?.value as TransactionType | '';
  const list = await listTransactions({
    search: search || undefined,
    type: type || undefined,
  });
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const tbody = document.querySelector('#txnTable tbody')!;
  tbody.innerHTML = list
    .map(
      (t) => `
    <tr>
      <td>${t.date}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(catName(t.categoryId))}</td>
      <td>${t.type}</td>
      <td class="amount-${t.type}">${t.type === 'expense' ? '−' : '+'}${formatMoney(t.amountMinor, settings.currency)}</td>
      <td><button class="btn" data-del="${t.id}">Delete</button></td>
    </tr>`
    )
    .join('');
  tbody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this transaction?')) return;
      await deleteTransaction((btn as HTMLElement).dataset.del!);
      await refreshAll();
    });
  });
}

async function renderBudgets() {
  const settings = await storage.getSettings();
  const budgets = await listBudgets();
  const txns = await storage.getAllTransactions();
  const container = document.getElementById('budgetList')!;
  if (budgets.length === 0) {
    container.innerHTML = '<p class="hint">No budgets yet. Create one to track limits.</p>';
    return;
  }
  const cards = await Promise.all(
    budgets.map(async (b) => {
      const u = await getBudgetUtilization(b, txns);
      const over = u.utilizationPercent > 100;
      return `
      <div class="card">
        <h3>${escapeHtml(b.name)}</h3>
        <p>${formatMoney(u.spentMinor, settings.currency)} / ${formatMoney(b.amountMinor, settings.currency)} (${u.utilizationPercent.toFixed(0)}%)</p>
        <div class="progress ${over ? 'over' : ''}"><span style="width:${Math.min(100, u.utilizationPercent)}%"></span></div>
        <p class="hint">${b.period}${b.categoryId ? ' · category' : ' · overall'}</p>
        <button class="btn" data-del-bud="${b.id}">Delete</button>
      </div>`;
    })
  );
  container.innerHTML = cards.join('');
  container.querySelectorAll('[data-del-bud]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteBudget((btn as HTMLElement).dataset.delBud!);
      await renderBudgets();
    });
  });
}

async function renderGoals() {
  const settings = await storage.getSettings();
  const goals = await listGoals();
  const container = document.getElementById('goalList')!;
  if (goals.length === 0) {
    container.innerHTML = '<p class="hint">No savings goals yet.</p>';
    return;
  }
  container.innerHTML = goals
    .map((g) => {
      const p = goalProgress(g);
      return `
      <div class="card">
        <h3>${escapeHtml(g.name)}</h3>
        <p>${formatMoney(g.currentAmountMinor, settings.currency)} / ${formatMoney(g.targetAmountMinor, settings.currency)} (${p.percent.toFixed(0)}%)</p>
        <div class="progress"><span style="width:${p.percent}%"></span></div>
        ${g.deadline ? `<p class="hint">Deadline: ${g.deadline}</p>` : ''}
        <div class="btn-row">
          <button class="btn primary" data-contrib="${g.id}">Contribute</button>
          <button class="btn" data-del-goal="${g.id}">Delete</button>
        </div>
      </div>`;
    })
    .join('');
  container.querySelectorAll('[data-contrib]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const amount = prompt('Contribution amount (major units)?');
      if (!amount) return;
      await contributeToGoal((btn as HTMLElement).dataset.contrib!, parseFloat(amount));
      await renderGoals();
    });
  });
  container.querySelectorAll('[data-del-goal]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteGoal((btn as HTMLElement).dataset.delGoal!);
      await renderGoals();
    });
  });
}

async function renderInsights() {
  const settings = await storage.getSettings();
  const txns = await storage.getAllTransactions();
  const range = getSelectedRange();
  const analysis = computeOverallAnalysis(txns, range, settings.currency);
  const anomalies = detectAnomalies(txns, range, settings.anomalySensitivity);
  const insights = generateInsights(txns, categories, range, previousMonthRange(), settings.currency, analysis);

  document.getElementById('anomalyList')!.innerHTML =
    anomalies
      .map(
        (a) =>
          `<li class="${a.severity === 'high' ? 'alert' : a.severity === 'medium' ? 'warning' : ''}"><strong>${escapeHtml(a.message)}</strong><br/>${escapeHtml(a.explanation)}</li>`
      )
      .join('') || '<li>No anomalies detected for this period.</li>';

  document.getElementById('insightListFull')!.innerHTML =
    insights
      .map(
        (i) =>
          `<li class="${i.type}"><strong>${escapeHtml(i.title)}</strong><br/>${escapeHtml(i.message)}</li>`
      )
      .join('') || '<li>Add transactions to generate insights.</li>';
}

function openAddTxnModal() {
  const modal = document.getElementById('modal') as HTMLDialogElement;
  const body = document.getElementById('modalBody')!;
  document.getElementById('modalTitle')!.textContent = 'Add transaction';
  const expCats = categories.filter((c) => c.type === 'expense' || c.type === 'both');
  body.innerHTML = `
    <label>Type
      <select id="mType"><option value="expense">Expense</option><option value="income">Income</option></select>
    </label>
    <label>Title <input id="mTitle" required maxlength="200" /></label>
    <label>Amount <input id="mAmount" type="number" min="0.01" step="0.01" required /></label>
    <label>Category
      <select id="mCat">${expCats.map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
    </label>
    <label>Date <input id="mDate" type="date" value="${todayIsoDate()}" required /></label>
  `;
  const form = document.getElementById('modalForm') as HTMLFormElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const type = (document.getElementById('mType') as HTMLSelectElement).value as TransactionType;
    const res = await createTransaction({
      type,
      title: (document.getElementById('mTitle') as HTMLInputElement).value,
      amountMajor: parseFloat((document.getElementById('mAmount') as HTMLInputElement).value),
      categoryId: (document.getElementById('mCat') as HTMLSelectElement).value,
      date: (document.getElementById('mDate') as HTMLInputElement).value,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    modal.close();
    await refreshAll();
  };
  modal.showModal();
}

function openAddBudgetModal() {
  const modal = document.getElementById('modal') as HTMLDialogElement;
  document.getElementById('modalTitle')!.textContent = 'New budget';
  document.getElementById('modalBody')!.innerHTML = `
    <label>Name <input id="mName" required /></label>
    <label>Amount <input id="mAmount" type="number" min="1" step="0.01" required /></label>
    <label>Period
      <select id="mPeriod"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option></select>
    </label>
  `;
  (document.getElementById('modalForm') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const res = await createBudget({
      name: (document.getElementById('mName') as HTMLInputElement).value,
      amountMajor: parseFloat((document.getElementById('mAmount') as HTMLInputElement).value),
      period: (document.getElementById('mPeriod') as HTMLSelectElement).value as any,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    modal.close();
    await renderBudgets();
  };
  modal.showModal();
}

function openAddGoalModal() {
  const modal = document.getElementById('modal') as HTMLDialogElement;
  document.getElementById('modalTitle')!.textContent = 'New savings goal';
  document.getElementById('modalBody')!.innerHTML = `
    <label>Name <input id="mName" required /></label>
    <label>Target amount <input id="mAmount" type="number" min="1" step="0.01" required /></label>
    <label>Deadline <input id="mDeadline" type="date" /></label>
  `;
  (document.getElementById('modalForm') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const res = await createGoal({
      name: (document.getElementById('mName') as HTMLInputElement).value,
      targetAmountMajor: parseFloat((document.getElementById('mAmount') as HTMLInputElement).value),
      deadline: (document.getElementById('mDeadline') as HTMLInputElement).value || undefined,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    modal.close();
    await renderGoals();
  };
  modal.showModal();
}

async function exportJson() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await storage.getAllTransactions(true),
    budgets: await storage.getAllBudgets(),
    savingsGoals: await storage.getAllGoals(),
    recurringPayments: await storage.getAllRecurring(),
    categories: await storage.getAllCategories(),
    settings: await storage.getSettings(),
  };
  downloadBlob(JSON.stringify(data, null, 2), 'finance-export.json', 'application/json');
}

async function exportCsv() {
  const txns = await storage.getAllTransactions();
  const header = ['id', 'type', 'title', 'amount_major', 'currency', 'categoryId', 'date', 'merchant', 'paymentMethod', 'notes'];
  const rows = txns.map((t) =>
    [
      t.id,
      t.type,
      escapeCsvCell(t.title),
      (t.amountMinor / 100).toFixed(2),
      t.currency,
      t.categoryId,
      t.date,
      escapeCsvCell(t.merchant || ''),
      t.paymentMethod || '',
      escapeCsvCell(t.notes || ''),
    ].join(',')
  );
  downloadBlob([header.join(','), ...rows].join('\n'), 'transactions.csv', 'text/csv');
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  const preview = document.getElementById('importPreview')!;
  try {
    if (file.name.endsWith('.json')) {
      const data = JSON.parse(text);
      pendingImport = data;
      preview.textContent = `JSON snapshot: ${data.transactions?.length ?? 0} transactions, ${data.budgets?.length ?? 0} budgets, ${data.savingsGoals?.length ?? 0} goals`;
      (document.getElementById('btnImportApply') as HTMLButtonElement).disabled = false;
    } else {
      preview.textContent = 'CSV import: basic support — use JSON for full restore. Preview first 5 lines:\n' + text.split('\n').slice(0, 5).join('\n');
      pendingImport = null;
      (document.getElementById('btnImportApply') as HTMLButtonElement).disabled = true;
    }
  } catch (err) {
    preview.textContent = 'Invalid file: ' + String(err);
    pendingImport = null;
  }
}

async function applyImport() {
  if (!pendingImport) return;
  if (!confirm('This will replace existing data. Continue?')) return;
  await storage.replaceAllData({
    transactions: pendingImport.transactions || [],
    budgets: pendingImport.budgets || [],
    savingsGoals: pendingImport.savingsGoals || [],
    recurringPayments: pendingImport.recurringPayments || [],
    categories: pendingImport.categories?.length ? pendingImport.categories : categories,
  });
  if (pendingImport.settings) await storage.saveSettings(pendingImport.settings);
  categories = await storage.getAllCategories();
  pendingImport = null;
  alert('Import applied');
  await refreshAll();
}

async function loadSettingsForm() {
  const s = await storage.getSettings();
  (document.getElementById('settingCurrency') as HTMLSelectElement).value = s.currency;
  (document.getElementById('settingTheme') as HTMLSelectElement).value = s.theme;
  (document.getElementById('settingAnomaly') as HTMLSelectElement).value = s.anomalySensitivity;
}

async function saveSettings() {
  const s = await storage.getSettings();
  s.currency = (document.getElementById('settingCurrency') as HTMLSelectElement).value as any;
  s.theme = (document.getElementById('settingTheme') as HTMLSelectElement).value as any;
  s.anomalySensitivity = (document.getElementById('settingAnomaly') as HTMLSelectElement).value as any;
  await storage.saveSettings(s);
  applyTheme();
  alert('Settings saved');
  await refreshOverview();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init().catch(console.error);
