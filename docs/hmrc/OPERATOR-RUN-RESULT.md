# Automated sandbox journey — operator run

**When:** 2026-07-18 13:49 UTC
**App:** https://spreadsheet-tax-production.up.railway.app  
**Sandbox application ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`  
**Evidence file:** `docs/hmrc/sandbox-journey-run.json`  

**We do not email log files to HMRC.** These calls hit sandbox so HMRC can see them on their side.

## Latest automated run (v1.33.7 branch verification)

| Step | Result |
|------|--------|
| OAuth | OK |
| Import SE/UK/foreign drafts | OK |
| Business Details | OK (SE business only on this taxpayer) |
| Obligations I&E | OK |
| SE period create | OK `2024-04-06_2024-07-05` |
| SE period retrieve | **OK** (taxYear path fixed) |
| UK / foreign period | **FAIL** — HMRC `429 MESSAGE_THROTTLED_OUT` |
| In-year calc trigger | **FAIL** — HMRC `429 MESSAGE_THROTTLED_OUT` |
| Final declaration obligations | OK |
| BSAS trigger | **FAIL** — HMRC `429 MESSAGE_THROTTLED_OUT` |
| SE annual | OK — HMRC HTTP 204 |
| ITSA status / Accounts | **FAIL** — HMRC `429 MESSAGE_THROTTLED_OUT` |
| BISS | **FAIL** — HMRC `429 MESSAGE_THROTTLED_OUT` |
| FPH validate | **FAIL** — 422, underlying HMRC `MESSAGE_THROTTLED_OUT`; honest unavailable headers remain omitted |

Latest exact score: **11/22 true 2xx**. The 11 failures are two
`RULE_PROPERTY_BUSINESS_ADDED` responses, the resulting app 502, seven HMRC
throttle responses, and the FPH validation failure caused by throttling. No
non-2xx response is counted as success.

The same run proved real non-mock OAuth and application-origin HMRC calls.
The operator test suite now treats the protected sandbox-check endpoint and
redacted public health response as security controls, rather than expecting
those details to be public.

## Remaining for full property evidence

1. Wait for the HMRC sandbox quota window to reset, then rerun the property,
   calculation, BSAS, ITSA, BISS, Accounts and FPH steps.
2. Reconcile the SA Test Support `RULE_PROPERTY_BUSINESS_ADDED` response with
   Business Details, which currently returns only the SE business for this NINO.
3. Checklist email only when you decide software is ready for SDSTeam review.

## Re-run command

```bash
RUN_HMRC_SANDBOX_E2E=1 npx playwright test tests/e2e/hmrc-mtd-full-journey.spec.js --config=playwright.prod.config.js --workers=1
```
