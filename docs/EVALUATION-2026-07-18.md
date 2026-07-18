# Evaluation — Spreadsheet Tax current state

**Date:** 2026-07-18  
**App version:** **1.20.0**  
**Branch:** `main`  

## Verdict (truth protocol)

| Claim | Verdict |
|-------|---------|
| Credible local sandbox / demo product | **Yes** |
| Unified SE + UK + foreign journey foundation | **Yes** |
| Cell-to-HMRC “Check your spreadsheet” | **Yes** (sanitised grid + proof; not Excel Online) |
| End-of-year product journey (guided case) | **Yes in 1.20** (stages/notes API + UI; live HMRC EOY not fully proven) |
| Practice beyond demo labels | **Partial** — full pipeline + action labels + ~10-client demo book; not production book size |
| Pilot-ready | **No** |
| Production-ready / marketable | **No** |
| 200 practices / 800k customers | **No — capacity gate NOT MET** |
| HMRC Recognised | **No** |

## What works (evidence)

| Area | Evidence |
|------|----------|
| Unit/integration tests | See `npm test` on this release |
| Quarterly sample → review → preview submit | e2e app-journey |
| Cumulative YTD table | `/app` after import |
| Spreadsheet check model | `spreadsheetCheck` on pipeline; gridRows, sheets, reuploadDiff, comments |
| Taxpayer home / onboarding / records | Routes + APIs |
| Guided year-end case | `/year-end` + `GET/PUT /api/me/eoy-case` (stages, completeCurrent, notes) |
| Practice work queue | `/workspace` + transitions with `actionLabel`; catalog ≥15 statuses |
| Platform foundations | Postgres/Redis/queue/worker code when env set |
| Capacity seed (CI) | 200 practices / 5k clients script — **not** 800k proof |

## Critical gaps (still)

1. **Capacity** — SQLite default; no proven 800k on HA Postgres + deadline load  
2. **Excel production** — xlsx vuln residual; LibreOffice container; ClamAV stub  
3. **EOY live HMRC** — case product complete; full sandbox ledger / production EOY still open  
4. **Practice scale** — demo book only, not 25k-client firm proof  
5. **Security launch gate** — CSRF/MFA/sign-off open  
6. **HMRC Production / Recognised** — external  

## Product surfaces

| URL | Role |
|-----|------|
| `/` | **Sales only** if signed out; **redirect `/home`** if signed in |
| `/home` | Taxpayer product home |
| `/app` | Quarterly update + Check your spreadsheet |
| `/onboarding` | Income sources setup |
| `/records` | Sources + drafts + receipts |
| `/year-end` | Guided tax return case |
| `/workspace` | Practice work queue |
| `/mtd` | Internal diagnostics |

## Bottom line

Product journeys for quarterly, spreadsheet confidence, EOY stages, and practice pipeline are in place.  
**Not** ready for real customers at national scale. Capacity gate **NOT MET**. Pilot/production/marketable = **No**.
