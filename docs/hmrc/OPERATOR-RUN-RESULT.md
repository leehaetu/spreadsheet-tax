# Automated sandbox journey — operator run

**When:** 2026-07-17/18  
**App:** https://spreadsheet-tax-production.up.railway.app  
**Sandbox application ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`  
**Evidence file:** `docs/hmrc/sandbox-journey-run.json`  

**We do not email log files to HMRC.** These calls hit sandbox so HMRC can see them on their side.

## Latest automated run (after SE retrieve fix)

| Step | Result |
|------|--------|
| OAuth | OK |
| Import SE/UK/foreign drafts | OK |
| Business Details | OK (SE business only on this taxpayer) |
| Obligations I&E | OK |
| SE period create | OK `2024-04-06_2024-07-05` |
| SE period retrieve | **OK** (taxYear path fixed) |
| UK / foreign period | Not run — no property business IDs on sandbox taxpayer |
| In-year calc trigger | OK (calculationId) |
| Final declaration obligations | OK |
| BSAS trigger | OK (HTTP 200 this run) |
| SE annual | Still may 400/502 depending on body rules |
| ITSA status / Accounts | 403 — not subscribed on Hub |
| BISS | Throttle or error in sandbox |
| FPH validate | May throttle without full browser FPH pack |

## Remaining for full property evidence

1. Create UK + foreign property businesses for the sandbox test user (Hub/test support or new test user setup), **or** I implement SA Test Support business creation if you want that next.
2. Subscribe Individual Details + Accounts on Hub if you want those 200s.
3. Checklist email only when you decide software is ready for SDSTeam review.

## Re-run command

```bash
npx playwright test tests/e2e/hmrc-mtd-full-journey.spec.js --config=playwright.prod.config.js
```
