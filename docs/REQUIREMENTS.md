# Requirements Traceability (v1.0)

| Requirement | Implementation | Test | Status |
|-------------|----------------|------|--------|
| Expense CRUD | transactionService + popup/dashboard | Manual + unit path | Implemented |
| Income CRUD | Same service, type=income | Manual | Implemented |
| Categories | DEFAULT_CATEGORIES + IndexedDB | Seed on init | Implemented |
| Search / filter | listTransactions filters | Manual | Implemented |
| Merchant / payment method | Model + forms | Manual | Implemented |
| Tags / notes | Model + validation | Manual | Implemented |
| Duplicate detection | findPotentialDuplicates + anomaly type | Unit (anomaly) | Partial |
| Budgets | budgetService + UI | Manual | Implemented |
| Savings goals | goalService + UI | Manual | Implemented |
| Recurring payments | Model + storage; limited UI | — | Scaffold |
| Overall analytics | analyticsEngine.computeOverallAnalysis | Unit | Implemented |
| Category analytics | computeCategorySpending | Unit | Implemented |
| Period comparison | computePeriodComparison + insights | Unit path | Implemented |
| Anomaly detection | detectAnomalies | Unit | Implemented |
| Insights | generateInsights | Manual | Implemented |
| Dashboard charts | Chart.js donut + line | Manual | Implemented |
| Popup quick entry | popup.ts | Manual | Implemented |
| Export JSON/CSV | dashboard export | Manual | Implemented |
| Import JSON | replaceAllData | Manual | Implemented |
| Local-first privacy | No network core path | Review | Implemented |
| Money accuracy | minor units + Decimal | Unit | Implemented |
| Manifest V3 | dist/manifest.json (generated) | Load unpacked | Implemented |
| Theme | light/dark | Manual | Implemented |

**Notes:** Recurring payment *management UI* and PDF reports are deferred beyond core v1. Chart.js is CDN-linked in dashboard for convenience; vendor locally before Web Store submission. Playwright E2E not yet automated in this package.

| Production dist paths | scripts/build.mjs → flat dist/ | Manual path check | Implemented |
| No CDN scripts | Chart.js bundled into dashboard.js | grep dist | Implemented |
| Restrictive CSP | script-src 'self' only | manifest review | Implemented |
