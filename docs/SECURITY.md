# Security

## Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| XSS via titles/notes | Sanitization + textContent / escaped HTML |
| CSV formula injection | `escapeCsvCell` prefixes risky cells |
| Malicious import | JSON schema checks; user confirmation before replace |
| Remote code | No eval, no remote scripts in CSP for extension pages |
| Data exfiltration | No network calls in core path; no analytics SDKs |
| Privilege | Minimal permissions (`storage`, `alarms`) |

## CSP

Extension pages use a strict CSP:

`script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'`

Chart.js is **bundled** into `dashboard.js` by the production build. No remote executable scripts are loaded.

## Storage limitations

`chrome.storage` and IndexedDB are readable by other code running as the same OS user. This extension does **not** encrypt data at rest. Recommend:

- Full-disk encryption
- Screen lock
- Avoid shared user accounts on the machine

## Messaging

Service worker only accepts known message types (`PING`, `OPEN_DASHBOARD`). No arbitrary code paths.
