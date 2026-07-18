# Evaluation — Spreadsheet Tax current state

**Date:** 2026-07-18  
**Local HEAD:** `33d19f3` / product entry fixes follow  
**App version:** **1.19.0** (not the older 1.18.0 audit that missed later commits)  
**Branch:** `main` **ahead of origin** — production Railway may still be older until push/deploy  

## Verdict (truth protocol)

| Claim | Verdict |
|-------|---------|
| Credible local sandbox / demo product | **Yes** |
| Unified SE + UK + foreign journey foundation | **Yes** |
| Cell-to-HMRC “Check your spreadsheet” | **Yes in 1.19** (sanitised grid + proof; not Excel Online) |
| Pilot-ready | **No** |
| Production-ready / marketable | **No** |
| 200 practices / 800k customers | **No — capacity gate NOT MET** |
| HMRC Recognised | **No** |

## What works (evidence)

| Area | Evidence |
|------|----------|
| Unit/integration tests | **159 pass** (`npm test`) |
| Quarterly sample → review → preview submit | e2e app-journey |
| Cumulative YTD table | `/app` after import |
| Spreadsheet check model | `spreadsheetCheck` on pipeline; gridRows, sheets, reuploadDiff, comments |
| Taxpayer home / onboarding / records | Routes + APIs |
| Guided year-end surface | `/year-end` (still operator-heavy in places) |
| Platform foundations | Postgres/Redis/queue/worker code when env set |
| Capacity seed (CI) | 200 practices / 5k clients script |

## Critical gaps (still)

1. **Sales vs app confusion** — fixed in this pass: signed-in `/` → `/home`; sign-in default `/home`; sales CTAs → app  
2. **Deploy lag** — commits not on origin/Railway until push  
3. **Capacity** — SQLite default; no proven 800k  
4. **Excel production** — xlsx vuln; LibreOffice container; ClamAV stub  
5. **EOY** — guided labels but still API-ish steps  
6. **Practice** — demo book, not 25k-client proof  
7. **Security launch gate** — CSRF/MFA/sign-off open  
8. **HMRC live sandbox full ledger** — partial; some non-2xx  

## Product surfaces (after entry fix)

| URL | Role |
|-----|------|
| `/` | **Sales only** if signed out; **redirect `/home`** if signed in |
| `/home` | Taxpayer product home |
| `/app` | Quarterly update + Check your spreadsheet |
| `/onboarding` | Income sources setup |
| `/records` | Sources + drafts + receipts |
| `/year-end` | Tax return case |
| `/workspace` | Practice |
| `/mtd` | Internal diagnostics |

## Bottom line

Direction is right. **Not** ready for real customers or 800k claims.  
**Do:** push + deploy 1.19, then Postgres/Redis cutover and capacity suite.
