# Architecture

## Overview

The extension follows a layered, local-first design:

```
┌─────────────────────────────────────────────┐
│  UI (Popup / Dashboard / Options)           │
├─────────────────────────────────────────────┤
│  Services (transaction, budget, goal)       │
├─────────────────────────────────────────────┤
│  Analytics Engine (pure functions)          │
├─────────────────────────────────────────────┤
│  Storage (IndexedDB + chrome.storage)       │
└─────────────────────────────────────────────┘
         ▲
         │  service worker (lifecycle / messaging)
```

## Data model versioning

`DATA_VERSION` in `types/models.ts` allows future migrations. Settings and full JSON exports include the version.

## Money representation

All amounts are stored as **integer minor units** (e.g. paise for INR). Display conversion uses `Decimal.js` and `Intl.NumberFormat`. Currencies are never mixed without an explicit exchange rate (not implemented in v1; single default currency per profile).

## Analytics

`analyticsEngine.ts` is UI-agnostic. It accepts transaction arrays and date ranges and returns:

- OverallAnalysis
- CategorySpending
- Period comparisons
- Anomalies (statistical, explainable)
- Insights (data-backed; `isEstimate` flag)

## Chrome integration

- **Popup:** fast capture + month summary
- **Dashboard:** full SPA-style page opened via `chrome.tabs.create`
- **Service worker:** install init, optional alarms
- **Permissions:** `storage`, `alarms` only

## Build

Vite multi-page build emits popup, dashboard, options, and background entry points into `dist/`.
