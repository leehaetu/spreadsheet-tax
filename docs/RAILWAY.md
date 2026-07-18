# Railway deployment

**Live URL:** https://spreadsheet-tax-production.up.railway.app  
**Project:** Spreadsheet-Tax · **Env:** production  

## What is actually on Railway (honest)

| Resource | Status |
|----------|--------|
| **spreadsheet-tax** (web app) | One Node service — serves **sales site + API + product UI** in one process |
| **Volume** `spreadsheet-tax-volume` → `/app/data` | SQLite + files (legacy / local cache path) |
| **Postgres** | Provisioned (managed DB service) — app gets `DATABASE_URL` |
| **Redis** | Provisioned — app gets `REDIS_URL` |
| **Separate “frontend” service** | **None** — not needed; HTML/JS is static from the same app |
| **Separate worker service** | **Optional** — code supports `npm run worker`; not always a second Railway service yet |
| **S3 / object storage bucket** | **Not provisioned** — quarantine uses volume path / `OBJECT_STORAGE_DIR` |
| **200 practices / 800k proven** | **NOT MET** — wiring infra ≠ load proof |

### Important honesty

- **“Production API ready when you add HMRC keys”** means: the **code path** can flip to production HMRC via env.  
- It does **not** mean: multi-service HA platform, capacity gate, or “put keys and sell to 800k”.  
- Live app may still use **SQLite** until `DATABASE_URL` is active and dual-write / cutover is healthy — check `/health` → `dbMode`, `postgresConfigured`, `redisConfigured`.

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
