# Medium security sweep — 2026-07-18

**Live base:** https://spreadsheet-tax-production.up.railway.app  
**Ship:** v1.33.3  

## Method

- Route inventory from `src/server.js` + `hmrc-mtd-routes.js`
- Live HTTP probe of internal/debug/admin/demo/metrics surfaces
- Fix material public exposures (same class as `/integrity`)

## Findings

| Sev | Finding | Action |
|-----|---------|--------|
| **P0** | `/integrity.html` still served via static/HTML after route 404 | Git-delete residual; block basename; robots disallow |
| **P0** | `/api/metrics/summary` public row counts (users/drafts/submits) | JOBS_SECRET required |
| **P0** | `/api/security/posture` public control-plane detail | JOBS_SECRET required |
| **P1** | `/api/status` dumped productSurfaces inventory + capacity platform | Slimmed to UI mode labels only |
| **P1** | `/health` exposed clientRows, volume path, scale design targets | Slimmed to probe fields |
| **P1** | Demo `/api/firms`, `/api/clients`, `/accountant`, `/practice` public | Off in production unless `DEMO_PUBLIC_PORTFOLIO=1` |
| **P1** | `/api/product-surfaces` full freeze inventory public | JOBS_SECRET |
| **P1** | `/api/hmrc/mtd/capabilities` public MTD matrix | Require sign-in |
| **P2** | `/api/import/sample` anonymous (creates drafts + sample NINO) | Documented residual; rate-limited; not fixed this pass (many tests + app sample path) |
| **P2** | Free template contains sample NINO `AA123456A` | Expected HMRC-style fixture; not real identity |
| OK | `/admin` | 302 → signin |
| OK | `/api/jobs/run` | 403 without secret |
| OK | `/integrity` `/api/integrity` | 404 after 1.33.2 |
| OK | CSRF enforced on public status | true |

## Residual (not claimed fixed)

1. **Anonymous sample import** still allowed — useful for app demo after sign-in is preferred; consider requiring session next pass.  
2. **Demo portfolio** remains available when `DEMO_PUBLIC_PORTFOLIO=1` or non-production.  
3. **No full pen-test** / dependency CVE audit in this pass.  
4. **CSRF + rate limits** already present; not re-validated under load.

## Ops notes

- Metrics: `x-jobs-secret: $JOBS_SECRET` on `/api/metrics/summary` and `/api/metrics/sales-weekly`  
- Demo pages: leave `DEMO_PUBLIC_PORTFOLIO` unset (or `0`) in production  
- Integrity map: `node scripts/print-integrity-map.mjs` only  

## Honesty

Not a penetration test. Medium sweep of **public surface exposure**. Capacity/pilot gates unchanged.
