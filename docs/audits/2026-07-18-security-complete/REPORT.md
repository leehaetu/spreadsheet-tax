# Security hardening completion report

**Date:** 2026-07-18  
**Ship:** v1.33.5  

## Work completed this session

### Implementation

1. **Admin authorization (server)** — `/admin` returns **403** unless user is `practice_admin` on a firm or listed in `OPERATOR_EMAILS`.  
2. **Admin UI** — removed call to global `/api/metrics/summary` from browser (ops-secret only); firm invite/audit only.  
3. **Ops secret alignment** — `PUT /api/admin/hmrc-service-status` accepts `x-jobs-secret` / `JOBS_SECRET`.  
4. **Dependency** — removed unused **`file-type`** (cleared moderate npm audit finding).  
5. **SheetJS residual** — already mitigated in `parse.js` / `excel-isolated.js` (kill switch, caps, sanitize); documented in `docs/SECURITY-HARDENING.md`.  
6. **Tests** — `tests/security-hardening-complete.test.js` locks unauth paths + admin gate + headers.

### Already shipped (1.33.2–1.33.4)

- Integrity public removal  
- Metrics/posture/demo portfolio lockdown  
- Auth for import/sample/submit/drafts  
- Sandbox-check secret  
- Open redirect fix  
- HSTS, Permissions-Policy, Secure cookies, no X-Powered-By  

### npm audit residual

| Package | Severity | Action |
|---------|----------|--------|
| `xlsx` | high | **No fix on npm** — isolation + kill switch + size limits; optional `EXCEL_KILL_SWITCH=1` |
| `file-type` | moderate | **Removed** (unused) |

## Live acceptance (after deploy)

| Check | Expected |
|-------|----------|
| `GET /api/hmrc/sandbox-check` | 403 |
| `POST /api/import/sample` (anon) | 401 |
| `POST /api/submit` (anon) | 401 |
| `GET /admin` signed-in non-admin | 403 |
| `GET /health` | no clientRows |
| Response headers | HSTS, no x-powered-by |

## Honesty

Security hardening for this product stream is **complete against the written bar in SECURITY-HARDENING.md**.  
It is **not** “unhackable” or pen-test certified. SheetJS CVE remains until an alternative workbook library is adopted.
