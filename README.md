# Personal Finance & Expense Intelligence

**Production-oriented Chrome Extension (Manifest V3)** for personal finance tracking, spending analysis, budgets, and savings goals.

## Principles

1. **Real analytics** — all insights are computed from stored transactions; estimates are labelled.
2. **Local-first privacy** — no account, no backend, no ads, no data leave the device unless you export.
3. **Popup + full dashboard** — quick capture in the popup; deep analysis in the dashboard.

## Features

- Expense & income CRUD with categories, merchants, payment methods, tags, notes
- Budgets (overall & category, weekly/monthly/yearly) with utilization
- Savings goals with progress and contribution tracking
- Analytics engine: overall, category, period comparison, weekday/weekend, anomalies
- Interactive charts (Chart.js)
- JSON / CSV export; JSON import with replace
- Light / dark theme
- Integer minor-unit money arithmetic (Decimal.js) for accuracy
- IndexedDB + chrome.storage.local

## Tech stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Extension | Manifest V3 | Current Chrome standard |
| Language | TypeScript | Type safety for financial logic |
| Build | Vite | Fast, ESM-native |
| Charts | Chart.js | Lightweight, no React required |
| Money | Decimal.js + integer minor units | Avoid float errors |
| Storage | IndexedDB + chrome.storage | Local-only, structured |
| Tests | Vitest | Fast unit tests |

## Project structure

```
src/
  analytics/       # Independent analytics engine
  background/      # Service worker
  dashboard/       # Full-page UI
  modules/         # (extensible domain modules)
  popup/           # Quick entry UI
  services/        # Business logic (transactions, budgets, goals)
  storage/         # IndexedDB / chrome.storage adapters
  types/           # Versioned data models
  utils/           # Money, validation, IDs
  options/         # Options page
public/
  manifest.json
  icons/
tests/
docs/
```

## Development

```bash
npm install
npm test
npm run build
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the **`dist`** folder (must contain `manifest.json`)
4. Pin the extension and open the popup
5. Use **Open Dashboard** for full analytics

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Windows step-by-step verification.

## Privacy & security

See [SECURITY.md](docs/SECURITY.md) and [PRIVACY.md](docs/PRIVACY.md).

- No host permissions for arbitrary sites
- No remote code
- CSP restricts extension pages
- CSV export escapes formula injection
- Input sanitization against XSS

**Limitation of local storage:** anyone with access to the OS user profile can read extension storage. Use OS-level disk encryption and lock the machine.

## Tests

```bash
npm test
```

## License

MIT
