# Railway deployment

**Live URL:** https://spreadsheet-tax-production.up.railway.app  
**Project:** Spreadsheet-Tax · **Env:** production  

## What is actually on Railway (honest) — verified 2026-07-18

| Resource | Status |
|----------|--------|
| **spreadsheet-tax** (web app) | One Node service — sales + API + product UI · **live appVersion 1.28.0** |
| **Volume** `spreadsheet-tax-volume` → `/app/data` | Files / object quarantine (`OBJECT_STORAGE_DIR=/app/data/objects`) |
| **Postgres-9ioQ** (current SoR) | **New** managed Postgres · `DATABASE_URL` → `${{Postgres-9ioQ.DATABASE_URL}}` · schema + **RLS policies applied** |
| **Postgres** (legacy) | Older DB still in project — not the active app URL after rewire |
| **Redis** | Online · `REDIS_URL` → `${{Redis.REDIS_URL}}` · rate-limit path reports `redis: true` |
| **Separate frontend** | **None** — static from same app |
| **Separate worker** | **Optional** — `npm run worker` not a second Railway service yet |
| **S3 bucket** | **Not provisioned** — volume path used |
| **200 / 800k capacity gate** | **NOT MET** — infra wired ≠ load proof |

### Important honesty

- Code + env vars are **not** the capacity gate. Check `/health` → `dbMode`, `postgresConfigured`, `redisConfigured`, `capacityGateMet`.  
- RLS policies exist on the **new** Postgres after migrate; app-layer RBAC/ABAC still required.  
- Redis rate limiting is **configured** when `REDIS_URL` is set; multi-instance proof still needs load evidence.

## GitHub

Source: `leehaetu/spreadsheet-tax` branch `main`, auto-deploy preferred.

```bash
railway up --detach -m "manual redeploy"
```

## Required variables (web service)

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | ≥32 chars |
| `TOKEN_ENCRYPTION_KEY` | ≥32 chars, ≠ session secret |
| `COOKIE_SECURE` | `1` |
| `DATA_DIR` | `/app/data` (volume) |
| `DATABASE_URL` | From Postgres service reference `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | From Redis service reference `${{Redis.REDIS_URL}}` |
| `HMRC_CLIENT_ID` / `HMRC_CLIENT_SECRET` | Developer Hub (sandbox now; Production later) |
| `HMRC_REDIRECT_URI` | `https://<domain>/api/hmrc/callback` |
| `HMRC_OAUTH_ENV` | `sandbox` until Production credentials |
| `HMRC_ALLOW_LIVE_SUBMIT` | `1` only when intentional; still needs real OAuth token |

## Architecture (current)

```
Browser
   │
   ▼
spreadsheet-tax (Express)  ──static HTML/JS (sales + app)
   │
   ├─ DATABASE_URL ──► Postgres (SoR dual-write when configured)
   ├─ REDIS_URL    ──► Redis (rate limits / optional locks)
   └─ /app/data    ──► Volume (SQLite fallback + uploads)
```

There is **no separate Next.js frontend**. Marketing + product are HTML under `public/` served by the same service.

## After adding Postgres / Redis

1. Confirm services **Postgres** and **Redis** are **SUCCESS** in the Railway dashboard.  
2. Confirm web service variables include `DATABASE_URL` and `REDIS_URL`.  
3. Redeploy `spreadsheet-tax` if needed.  
4. Hit `GET /health` and check:
   - `postgresConfigured: true`
   - `redisConfigured: true`
   - `dbMode` may still show `sqlite` for process store until full cutover; dual-write uses Postgres when URL is set  
5. Capacity gate remains **false** until load evidence.

## Optional next services

| Service | Purpose |
|---------|---------|
| **worker** | Second deploy of same repo with start command `npm run worker` for queues |
| **Bucket** | S3-compatible object storage for quarantined spreadsheets |
| **Staging** environment | Mirror production without touching live |

## Demo (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!` — not a production customer base.
