# Testing

## Unit tests

```bash
npm install
npm test
```

Coverage focuses on:

- Money conversion and arithmetic (`tests/money.test.ts`)
- Analytics calculations (`tests/analytics.test.ts`)

## Manual verification checklist

1. Load unpacked extension
2. Add expense from popup → appears in recent list
3. Add income → net cash flow updates
4. Open dashboard → KPIs and charts reflect data
5. Create budget → utilization bar moves with expenses
6. Create goal → contribute updates progress
7. Export JSON → re-import after clear (optional)
8. Toggle theme
9. Search transactions

## Security checks

- Titles with `<script>` render as text, not HTML
- CSV cells starting with `=` are quoted
- No unexpected network requests in DevTools for core flows


## Production build verification

```bash
npm install
npm test
npm run build
```

Confirm `dist/` contains:

- `manifest.json` with `default_popup: popup.html` and `service_worker: background.js`
- `popup.html`, `popup.js`, `dashboard.html`, `dashboard.js`, `background.js`
- `assets/*.css`, `icons/*.png`
- No `cdn.jsdelivr` references in any dist HTML/JS

After Load unpacked, use Chrome’s extension error panel and DevTools consoles (popup + dashboard + service worker) to confirm zero critical errors.
