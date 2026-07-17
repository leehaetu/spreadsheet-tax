# Project status

**Last updated:** 2026-07-17 (end of continuous automated session)  
**Branch:** `main` (pushed)

## Highest proven capability

| Label | Status |
|-------|--------|
| **Gate 0 Safe demo** | **Done** |
| **Pilot foundation (in-repo)** | **Done** — auth, SQLite, drafts, workspace, mock OAuth, fraud headers, billing stub |
| **Production ready** | **Not done** — needs real HMRC approval, pen-test, legal pack, live billing |

## Tests (latest)

- `npm test` → **66 pass**
- `npm run test:e2e` → **15 pass** (smoke + visual + mock HMRC connect)

## Commits this session (main)

1. Gate 0 safe demo + docs OS + CI + Playwright  
2. Auth + drafts + workspace  
3. HMRC OAuth mock/real + fraud headers + billing stub  
4. Security headers + create client + submission history  

## What you can use now

| URL | Feature |
|-----|---------|
| `/` | Sales hub |
| `/app` | Free check → review → preview submit |
| `/signin` | Auth (`demo@spreadsheet-tax.example` / `DemoPass123!`) |
| `/workspace` | Practice clients + add client + advance status |
| `/connect-hmrc` | Mock (or real) OAuth connect |
| `/billing` | Plan select (no cards) |
| `/account` | Account + plan + HMRC status |

## Still external / human

- HMRC Developer Hub production approval  
- Real card payments  
- Independent pen-test & legal counsel  
- Customer interviews for price lock  
- Full WCAG audit sign-off  

## Env flags

See README / prior STATUS for `HMRC_*`, `DEMO_PRACTICE_WRITES`, `DATA_DIR`.
