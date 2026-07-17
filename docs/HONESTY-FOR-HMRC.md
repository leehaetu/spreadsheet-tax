# Honesty for HMRC inspection

**Purpose:** Anyone reviewing this codebase (including HMRC) can separate **real bridging software** from **preview / mock / demo** layers.

**Live map:** https://spreadsheet-tax-production.up.railway.app/integrity  
**API:** `GET /api/integrity` · `GET /api/status`

## Real product (inspectable)

| Capability | Code path |
|------------|-----------|
| Parse CSV/XLSX period files | `src/lib/parse.js` |
| Map fields → HMRC period summary figures | `src/lib/map.js` |
| Build quarterly payloads | `src/lib/payloads.js` |
| Digital links / traces | pipeline + map traces |
| Import validation | `src/lib/validation.js` `validateImport` |
| Submit identifier validation | `validateSubmission` (NINO, tax year, business IDs) |
| Server-owned drafts | `src/lib/drafts.js` · submit requires `draftId` in production |
| Request construction for HMRC APIs | `src/lib/hmrc-client.js` `buildSubmitRequest` |
| Fraud-prevention header **subset** | `src/lib/fraud-headers.js` |
| Authenticated practice SQLite | `src/lib/practice-db.js` · `/workspace` |
| Auth sessions | `src/lib/auth.js` |

## Explicitly not HMRC filing (by design)

| Layer | Behaviour |
|-------|-----------|
| **Double / preview submit** | Default when `HMRC_ALLOW_LIVE_SUBMIT` ≠ `1`. Builds request, stores local preview receipt, **no external HMRC HTTP**. |
| **Mock OAuth** | When no Hub credentials or `HMRC_OAUTH_MOCK=1`. Tokens start with `mock-`. Status reports `connected: false`, `mock: true`. Mock tokens **cannot** be used for external submit. |
| **Demo portfolio** | `/accountant`, `/practice`, `/api/firms`, `/api/clients` — in-memory fiction, `demo: true`. |
| **Billing** | Plan row only — no card capture. |
| **Email** | Stub logger — not delivered. |

## Enabling real sandbox/live (checklist)

1. Register app on HMRC Developer Hub  
2. Set `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`, `HMRC_REDIRECT_URI`  
3. Set `HMRC_OAUTH_MOCK=0` (or unset)  
4. User completes real OAuth → non-mock token stored  
5. Set `HMRC_ALLOW_LIVE_SUBMIT=1` only on controlled environments  
6. Expand and validate fraud-prevention headers against current HMRC guidance  
7. Obtain production approval before live filing  

## IP

Lee Hine — see `LICENSE`, `/legal`, `/license`.
