# Security hardening — complete bar (2026-07-18)

**App version:** 1.33.5 (target ship)  
**Live:** https://spreadsheet-tax-production.up.railway.app  

## Definition of done (this stream)

| # | Criterion | Status |
|---|-----------|--------|
| H1 | No public integrity / sandbox-check / ops metrics | **MET** |
| H2 | Auth required for import, sample, submit, draft GET | **MET** |
| H3 | Cross-user draft IDOR denied | **MET** |
| H4 | Open redirect after login blocked | **MET** |
| H5 | Admin HTML not available to normal users | **MET** (server 403) |
| H6 | Secure cookies + HSTS in production | **MET** |
| H7 | Unused vulnerable `file-type` removed | **MET** |
| H8 | SheetJS residual documented + isolated parse | **MET** (no npm fix) |
| H9 | Security tests in CI unit suite | **MET** |
| H10 | Live re-probe of critical paths | **required after deploy** |

## Not in scope / residual

| Residual | Why |
|----------|-----|
| `xlsx` high CVE (no npm fix) | Mitigated: worker isolation, size caps, magic bytes, EXCEL_KILL_SWITCH, sanitizeRow; CSV preferred |
| CSP `unsafe-inline` | Sales/auth inline scripts; nonce migration is larger product change |
| Formal CREST pen-test | External engagement |
| Email MFA phishing beyond open-redirect | Partial |

## Operator env

| Variable | Purpose |
|----------|---------|
| `JOBS_SECRET` | Metrics, sales-weekly, sandbox-check, ops jobs |
| `OPERATOR_EMAILS` | Optional platform operator emails for `/admin` without firm role |
| `COOKIE_SECURE=1` | Force Secure cookies (auto on production/Railway) |
| `EXCEL_KILL_SWITCH=1` | Disable Excel parse (CSV only) during incident |
| `DEMO_PUBLIC_PORTFOLIO=1` | Only if demo accountant pages must be public (default off in prod) |

## Commands

```bash
# Unit security suite
node --test tests/security-hardening-complete.test.js tests/security-controls.test.js tests/gate0-safety.test.js

# Live critical probe
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/hmrc/sandbox-check"   # 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/import/sample" -H 'Content-Type: application/json' -d '{"sample":"combined"}'  # 401

# Ops metrics
curl -s -H "x-jobs-secret: $JOBS_SECRET" "$BASE/api/metrics/sales-weekly?days=7"
```

## Prior evidence packs

- Medium sweep: `docs/audits/2026-07-18-security-sweep.md`
- Hard live test: `docs/audits/2026-07-18-hard-security/REPORT.md`
