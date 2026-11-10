# Changelog

## 1.0.0 – 2026-11-09

### Fixed (production build phase)
- Flat `dist/` layout with correct Manifest V3 paths (`popup.html`, `dashboard.html`, `background.js`)
- Chart.js bundled into `dashboard.js` — CDN removed
- CSP restricted to `script-src 'self'` (no remote executable JS)
- `chrome.runtime.getURL('dashboard.html')` paths corrected
- `scripts/build.mjs` esbuild production builder; `npm run build` uses it

### Added
- Manifest V3 Chrome extension foundation
- Popup quick expense/income entry
- Full dashboard with KPIs, category donut, spending trend
- Transaction list with search and delete
- Budgets with utilization bars
- Savings goals with progress and contributions
- Analytics engine (overall, category, period, anomalies, insights)
- JSON / CSV export; JSON import
- Local-first storage (IndexedDB + chrome.storage)
- Integer minor-unit money handling
- Light / dark themes
- Documentation (Architecture, Security, Privacy, User Guide, Deployment)
- Unit tests for money utils and analytics
