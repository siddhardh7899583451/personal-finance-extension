# Deployment & Load Unpacked

## Prerequisites

- Node.js 18+
- Chrome / Chromium

## Build

```bash
cd personal-finance-extension
npm install
npm run build
```

`npm run build` runs `scripts/build.mjs` (esbuild) and produces a **flat** `dist/` folder ready for Chrome.

Optional Vite path (if Vite is installed):

```bash
npm run build:vite
```

### Expected `dist/` layout

```
dist/
  manifest.json
  popup.html
  popup.js
  dashboard.html
  dashboard.js
  options.html
  background.js
  assets/
    popup.css
    dashboard.css
  icons/
    icon16.png
    icon48.png
    icon128.png
```

All script references are local (`'self'`). Chart.js is **bundled** into `dashboard.js` — no CDN.

## Load unpacked (Windows)

1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked**.
5. Select the `dist` folder inside `personal-finance-extension` (the folder that contains `manifest.json`).
6. Confirm the extension appears with no errors in the extensions page.
7. Pin the extension if desired.
8. Click the extension icon → popup should open.
9. In the popup, click **Open Dashboard** → full dashboard tab.
10. Add an expense in the popup; confirm it appears under Recent.
11. In Dashboard → Transactions: search, delete.
12. Overview: KPIs and charts update from stored data.
13. Reports: Export JSON / CSV; optionally re-import JSON.
14. Reload Chrome (or turn the extension off/on) and confirm data still present.

### Troubleshooting

| Issue | Check |
|-------|--------|
| "Service worker registration failed" | Open service worker link on the extensions page; look for console errors |
| Blank popup | Right-click popup → Inspect; check console for module errors |
| Charts missing | Confirm `dashboard.js` is ~200KB+ (Chart.js bundled) |
| Manifest path errors | Ensure you loaded `dist/`, not the repo root |

## CSP

Production CSP (no remote scripts):

```
script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'
```

## Chrome Web Store checklist

- [x] Vendor Chart.js locally (bundled via esbuild)
- [x] Restrictive CSP without CDN
- [ ] Production-quality icons (current icons are placeholders)
- [ ] Privacy policy URL
- [ ] Store description and screenshots
- [ ] ZIP of **dist** contents only
- [ ] Do not claim store approval until granted

## Production ZIP

```bash
npm run build
cd dist && zip -r ../finance-intelligence-v1.0.0.zip .
```
