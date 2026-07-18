# Security hardening — complete bar (2026-07-18)

**App version:** **1.34.0**  
**Live:** https://spreadsheet-tax-production.up.railway.app  

## Done bar (no open items from prior residual list)

| # | Criterion | Status |
|---|-----------|--------|
| H1 | No public integrity / sandbox-check / ops metrics | **MET** |
| H2 | Auth required for import, sample, submit, draft GET | **MET** |
| H3 | Cross-user draft IDOR denied | **MET** |
| H4 | Open redirect after login blocked | **MET** |
| H5 | Admin HTML not available to normal users | **MET** |
| H6 | Secure cookies + HSTS in production | **MET** |
| H7 | Unused vulnerable `file-type` removed | **MET** |
| H8 | **SheetJS/`xlsx` high CVE eliminated** (exceljs only) | **MET** |
| H9 | Security tests in unit suite | **MET** |
| H10 | Live re-probe of critical paths | **MET** |
| H11 | **npm audit: 0 vulnerabilities** | **MET** |
| H12 | **CSP script-src without `unsafe-inline`** (per-response nonces) | **MET** |

## Residual (CSS only — not script execution)

| Item | Note |
|------|------|
| `style-src 'unsafe-inline'` | ~140 layout `style=` attributes on marketing HTML. Not script RCE. Full removal is a CSS refactor, not a vuln close. |

There is **no remaining high/critical npm CVE** and **no remaining open public surface** from the hard-test residual list.

## Operator env

| Variable | Purpose |
|----------|---------|
| `JOBS_SECRET` | Metrics, sales-weekly, sandbox-check, ops jobs |
| `OPERATOR_EMAILS` | Platform operator emails for `/admin` |
| `COOKIE_SECURE=1` | Force Secure cookies |
| `EXCEL_KILL_SWITCH=1` | Disable Excel parse (CSV only) during incident |
| `DEMO_PUBLIC_PORTFOLIO=1` | Demo accountant pages (default off in prod) |

## Commands

```bash
npm audit          # expect: found 0 vulnerabilities
npm test           # unit suite
node --test tests/security-hardening-complete.test.js tests/parse-xlsx-safety.test.js
```

## Evidence packs

- Medium: `docs/audits/2026-07-18-security-sweep.md`
- Hard: `docs/audits/2026-07-18-hard-security/REPORT.md`
- Complete: `docs/audits/2026-07-18-security-complete/REPORT.md`
