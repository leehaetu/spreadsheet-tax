# Sales weekly readout

**Purpose:** Track free-funnel signal (CTA clicks + new registers) without tax data.  
**Not:** conversion % proof, pilot metrics, capacity evidence.

## Endpoint

```http
GET /api/metrics/sales-weekly?days=7
Header: x-jobs-secret: <JOBS_SECRET>
```

Response aggregates only:

- `registers` — new `users` in the window  
- `ctaEvents` — rows in `cta_events`  
- `ctaByEvent` / `ctaByPath` — breakdown  

No emails, NINOs, or spreadsheet contents.

## Local

```bash
# server with default dev secret
JOBS_SECRET=dev-jobs-secret BASE_URL=http://127.0.0.1:3456 \
  node scripts/sales-weekly-report.mjs
```

## Production

```bash
BASE_URL=https://spreadsheet-tax-production.up.railway.app \
  JOBS_SECRET="$JOBS_SECRET" \
  DAYS=7 \
  node scripts/sales-weekly-report.mjs
```

Writes `docs/audits/sales-weekly/YYYY-MM-DD.md` (+ `.json`).

## Cadence

1. Once per week (Monday is fine).  
2. Keep the markdown in git if you want a history.  
3. Watch: registers trend, top CTA events (`get-started-free`, `download-template`).  

## Honesty

- CTA table is **click beacons**, not unique visitors.  
- Do not invent a “conversion rate” without a real session/visit source.  
- Empty window after a fresh volume/DB cutover is expected until traffic lands.
