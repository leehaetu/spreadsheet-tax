# Automated sandbox journey — operator run

**When:** 2026-07-17 (UTC)  
**App:** https://spreadsheet-tax-production.up.railway.app  
**Sandbox application ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`  
**Machine evidence:** `docs/hmrc/sandbox-journey-run.json`  

We **do not email log files to HMRC**. This run made **real calls** to `test-api.service.hmrc.gov.uk` so **HMRC’s own logs** for the sandbox app contain traffic.

## Results (first full automated pass)

| Step | Result |
|------|--------|
| Product login + HMRC OAuth | **OK** |
| Import SE / UK / foreign samples | **OK** (drafts created) |
| Business Details list | **OK** — SE only on this test user (`XBIS12345678901`) |
| Obligations I&E | **OK** (HTTP 200) |
| SE period create | **OK** — `periodId: 2024-04-06_2024-07-05` |
| SE period retrieve | **Fixed after run** (was missing taxYear in path) |
| UK / foreign period | **Skipped** — test user has **no** property businesses (only SE) |
| In-year calculation trigger | **OK** — calculationId returned (202) |
| Final declaration obligations | **OK** |
| SE annual | Body validation failed (empty adjustments) — **minimal body improved in code** |
| BSAS / BISS | **Throttled** by HMRC (`MESSAGE_THROTTLED_OUT`) — call reached HMRC |
| ITSA status | **403 not subscribed** — subscribe **Self Assessment Individual Details (MTD)** on Hub |
| Accounts balance | **403 not subscribed** — subscribe **Self Assessment Accounts (MTD)** on Hub |
| FPH validate | Throttled / incomplete headers when run from server without browser device id |

## What Lee still does on Hub (I cannot)

1. Subscribe missing APIs if you want those 200s:  
   - Self Assessment Individual Details (MTD)  
   - Self Assessment Accounts (MTD)  
2. Optionally create UK/foreign property businesses on the sandbox taxpayer (or new test user with property) so property period submits can return 200.  
3. After more successful runs + when software feels solid: fill checklist + email SDSTeam **once** (still **no** Production app until they grant).

## How to re-run (I will re-run after deploy)

```bash
# with Railway HMRC_* env loaded
npx playwright test tests/e2e/hmrc-mtd-full-journey.spec.js --config=playwright.prod.config.js
```

## SDSTeam send?

**Not yet.** Core SE in-year is proven again. Property needs property businesses on the test identity. Wait out throttling for BSAS/BISS. Subscribe missing APIs for P3 200s. Then one checklist email.
