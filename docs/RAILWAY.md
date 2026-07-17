# Railway deployment

**Live URL:** https://spreadsheet-tax-production.up.railway.app  
**Project:** Spreadsheet-Tax · **Service:** spreadsheet-tax · **Env:** production  

## GitHub

Service source should be `leehaetu/spreadsheet-tax` branch `main` with auto-deploy on.

If deploys stall: Settings → Source → reconnect GitHub, or from this repo:

```bash
railway up --detach -m "manual redeploy"
```

## Required variables (set on the service)

| Variable | Example / notes |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | long random hex |
| `TOKEN_ENCRYPTION_KEY` | long random hex |
| `COOKIE_SECURE` | `1` (HTTPS) |
| `DATA_DIR` | `/app/data` (**must match volume mount**) |
| `HMRC_OAUTH_MOCK` | `1` until real Hub credentials |
| `HMRC_ALLOW_LIVE_SUBMIT` | `0` for public demo |
| `DEMO_PRACTICE_WRITES` | `0` |
| `JOBS_SECRET` | random secret for `/api/jobs/run` |

Optional later:

| Variable | Notes |
|----------|--------|
| `HMRC_CLIENT_ID` / `HMRC_CLIENT_SECRET` | Developer Hub |
| `HMRC_REDIRECT_URI` | `https://<domain>/api/hmrc/callback` |
| `HMRC_OAUTH_ENV` | `sandbox` or `production` |
| `ALLOW_CLIENT_PAYLOAD_SUBMIT` | Never set in production |
| `SQLITE_PATH` | Override DB file (default: `$DATA_DIR/db/spreadsheet-tax.sqlite`) |

`PORT` is provided by Railway.

## Volume (required for customer data)

| Field | Value |
|-------|--------|
| Name | `spreadsheet-tax-volume` |
| Mount | `/app/data` |
| Default size | **5 GB** (Hobby plan max default) |
| Holds | SQLite DB, future uploads/exports/backups |

### Layout on the volume

```
/app/data/
  db/spreadsheet-tax.sqlite   # primary store
  uploads/                    # reserved for period files if persisted
  exports/                    # reserved for large CSV jobs
  backups/                    # reserved for DB snapshots
```

`DATA_DIR=/app/data` is set on the service. Without the volume, redeploys wipe SQLite.

### Sizing for ~600,000 customers

Rough guidance (client metadata + drafts/submissions, not raw spreadsheet archives):

| Customers | Suggested volume | Notes |
|-----------|------------------|--------|
| Pilot (≤5k) | 5 GB | Current Hobby default — **already attached** |
| Growth (~50–100k) | **50 GB** | Upgrade Railway **Pro**, live-resize volume |
| Target **600k** | **100–250 GB+** | Pro self-serve up to 1 TB; prefer **Postgres** for multi-instance |

**CLI cannot live-resize yet** — use Railway dashboard:

1. Open project → service **spreadsheet-tax** → volume **spreadsheet-tax-volume**
2. **Live Resize** → choose larger size (Pro required above 5 GB)
3. Confirm `DATA_DIR=/app/data` still set

App scale features already shipped for large books:

- SQL indexes on clients / drafts / audit
- Paginated `GET /api/me/clients` (limit/offset/q/status/needsAction)
- SQL aggregate practice dashboard (no full-table load)

**Honest limit:** one SQLite file on one volume cannot be multi-replica. At full 600k multi-tenant concurrent load, add **Railway Postgres** and point the app at `DATABASE_URL` (future workstream). Volume remains for uploads/exports.

### Re-attach volume (if missing)

```bash
railway volume list --json
# only if none attached:
railway volume add --mount-path /app/data --json
railway variable set DATA_DIR=/app/data
```

One volume per service (Railway limit).

## Single service

One web service is enough for the pilot. Add Postgres when multi-instance or 600k concurrent practice load is required; until then SQLite on the volume is intentional.
