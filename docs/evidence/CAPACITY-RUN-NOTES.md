# Capacity evidence run notes

**Date:** 2026-07-18  
**Target DB:** Railway **Postgres-9ioQ** (public proxy used for seed/load from workstation)  
**App Redis:** Railway Redis (production) · load harness Redis probe used local Redis for rate-limit unit path

## What was executed (not claimed as 800k gate)

| Step | Result |
|------|--------|
| Seed | **200 practices**, **5_000 clients**, largest practice **2_000** clients |
| Client list p50/p95/p99 | ~17 / ~101 / ~110 ms (80 samples) |
| Concurrent lists (25×4) | p95 ~206 ms, isolation cross-tenant IDs **0** |
| Queue | 200 enqueue + 200 process, depth 0 |
| Worker recovery | simulated crash → second worker drained (**ok**) |
| Excel isolated parse | ok (~136 ms) |
| **800k full gate** | **NOT MET** — clients 5k not 800k; largest practice 2k not 10k+ |

## Artifacts

- `docs/evidence/capacity-latest.json`
- `docs/evidence/capacity-run-*.json`

## Railway services after this work

| Service | Role |
|---------|------|
| spreadsheet-tax | Web + API |
| spreadsheet-tax-worker | `npm run worker` |
| Postgres-9ioQ | App `DATABASE_URL` |
| Redis | App `REDIS_URL` |
| Postgres (legacy) | Not active app URL |

**Do not market as pilot-ready or 800k-capable from this run.**
