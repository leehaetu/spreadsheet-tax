# Railway deployment notes

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
| `DATA_DIR` | `/app/data` (must match volume mount) |
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

`PORT` is provided by Railway.

## Volume

- Name: `spreadsheet-tax-volume`  
- Mount: `/app/data`  
- Holds SQLite DB so users/drafts survive redeploys  

## Single service

One web service is enough for the pilot. Add Postgres later if multi-instance is required; until then SQLite on the volume is intentional.
