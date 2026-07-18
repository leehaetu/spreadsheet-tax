# Endpoint evidence ledger

**Rule:** Route existence is not HMRC proof. Only exact HTTP status + HMRC code rows may be cited as `SANDBOX_HTTP`.  
**Source journey (rescored):** `docs/hmrc/sandbox-journey-run.json` · **rescoredAt** in file · **summary.true2xx=16** · **failed=4** · **okish=null**  
**Updated:** 2026-07-18  

## How to read tags

| Tag | Meaning |
|-----|---------|
| `SANDBOX_HTTP` | Real call; status recorded below |
| `CUSTOMER_WORKFLOW` | User path exists (`/app`, `/year-end`) |
| `UNIT_TESTED` | Automated test of product path |
| `ROUTE_ONLY` | Code path only — **not** HMRC success |
| `PREVIEW_ONLY` | Product receipt without HMRC HTTP |

Non-2xx is **fail**. Never use “okish”.

---

## Journey-backed HMRC / product steps (from sandbox-journey-run.json)

| Capability | API / path | Workflow | HTTP status | HMRC code | ok? | Tag |
|------------|------------|----------|-------------|-----------|-----|-----|
| OAuth connected | product `/api/hmrc/status` | connect-hmrc | 200 (product) | — | true | `CUSTOMER_WORKFLOW` |
| Import SE sample | product import | /app | 200 + draftId | — | true | `CUSTOMER_WORKFLOW` + `UNIT_TESTED` |
| Import UK sample | product import | /app | 200 + draftId | — | true | same |
| Import FP sample | product import | /app | 200 + draftId | — | true | same |
| Create UK test business | SA Test Support POST `.../business/{nino}` | setup | **400** | `RULE_PROPERTY_BUSINESS_ADDED` | **false** | setup fail (already added) |
| Create FP test business | same | setup | **400** | `RULE_PROPERTY_BUSINESS_ADDED` | **false** | setup fail |
| Business Details list | GET `.../business/details/{nino}/list` | app fill IDs | **200** | — | true | `SANDBOX_HTTP` |
| Obligations I&E | GET `/obligations/details/{nino}/income-and-expenditure` | app | **200** | — | true | `SANDBOX_HTTP` |
| SE period create | POST `.../self-employment/{nino}/{bid}/period` | /app submit · workflow se_period | **200** | — | true | `SANDBOX_HTTP` + `CUSTOMER_WORKFLOW` |
| SE period retrieve | GET `.../period/{taxYear}/{periodId}` | readback | **200** | — | true | `SANDBOX_HTTP` |
| UK property period create | POST `.../property/uk/.../period/{taxYear}` | /app · uk_period | **201** | — | true | `SANDBOX_HTTP` |
| Foreign property period create | POST `.../property/foreign/.../period/{taxYear}` | /app · fp_period | **201** | — | true | `SANDBOX_HTTP` |
| Calculations trigger in-year | POST `.../calculations/.../trigger/in-year` | year-end calc | **202** | — | true | `SANDBOX_HTTP` |
| Final declaration obligations | GET `/obligations/details/{nino}/crystallisation` | year-end | **200** | — | true | `SANDBOX_HTTP` |
| SE annual PUT | PUT `.../self-employment/.../annual/{taxYear}` | year-end se_annual | **204** | — | true | `SANDBOX_HTTP` |
| BSAS trigger | POST `.../adjustable-summary/{nino}/trigger` | year-end bsas_trigger | **200** | — | true | `SANDBOX_HTTP` |
| ITSA status | GET `.../person/itsa-status/{nino}/{taxYear}` | extras | **200** | — | true | `SANDBOX_HTTP` |
| BISS | GET `.../income-summary/...` | extras | **200** | — | true | `SANDBOX_HTTP` |
| Accounts balance | GET `/accounts/self-assessment/.../balance-and-transactions` | extras | **429** | `MESSAGE_THROTTLED_OUT` | **false** | fail (throttle) |
| FPH validate | Test FPH API | integrity | **422** | `MESSAGE_THROTTLED_OUT` | **false** | fail (throttle); headers policy honest omit |

## Product workflows (receipt path) — UNIT_TESTED preview

All names in `src/lib/workflows.js` `KNOWN_WORKFLOWS` driven via `POST /api/workflows/run` with session; without live flag each returns **preview receipt** (`mode=double`, `receiptId`). Evidence: `tests/workflows-year-end.test.js` + `{SCRATCH}/workflows.log`.

| Workflow | Customer UI | Live HMRC | Preview receipt | Tag |
|----------|-------------|-----------|-----------------|-----|
| se_period | /year-end + /app | journey 200 | yes | `SANDBOX_HTTP` + `CUSTOMER_WORKFLOW` |
| uk_period | same | journey 201 | yes | same |
| fp_period | same | journey 201 | yes | same |
| se_amend | /year-end | not in journey | yes `PREVIEW_ONLY` until re-run | `CUSTOMER_WORKFLOW` + `UNIT_TESTED` |
| final_obligations | /year-end | journey 200 | yes | `SANDBOX_HTTP` |
| se_annual | /year-end | journey 204 | yes | `SANDBOX_HTTP` |
| uk_annual | /year-end | **not in journey** | yes | `CUSTOMER_WORKFLOW` + `UNIT_TESTED` / live = pending re-run |
| fp_annual | /year-end | **not in journey** | yes | same |
| other_income | /year-end (TLA) | **not in journey** | yes | same; Hub may 403 if unsubscribed |
| losses | /year-end | **not in journey** | yes | same |
| calc / calc_list | /year-end | calc 202 | yes | `SANDBOX_HTTP` (calc) |
| bsas_trigger / bsas_list | /year-end | trigger 200 | yes | `SANDBOX_HTTP` (trigger) |
| bsas_adjust | /year-end | **not in journey** | yes | `CUSTOMER_WORKFLOW` + `UNIT_TESTED` |
| final_calc | /year-end | **not in journey** | yes | same |

## Error / token-expiry behaviour (product)

| Case | Behaviour | Evidence |
|------|-----------|----------|
| Unknown workflow name | 400 before any receipt | workflows-year-end.test.js |
| No session | 401 | workflows-year-end.test.js |
| Missing nino | 400 | workflows-year-end.test.js |
| Cross-user draftId | 403 | tenant-isolation.test.js |
| Mock OAuth + live flag | 403 external submit | gate0 / server |
| Anonymous live submit | 401 / double only | server submit guards |
| Expired/missing token | MTD routes 400 connect first | hmrc-mtd-routes requireLiveToken |
| HMRC 429 throttle | recorded as fail in journey | accounts_balance, fraud_validate |

## Token-expiry / error matrix (adapter)

| Case | Expected | Status |
|------|----------|--------|
| No token + live | 400/403 domain error | unit / route |
| Expired connection | treated as no active token | code path |
| HMRC 4xx body.code | product surfaces status + code | journey snippets |

## Production switch

Host/credentials/env only — `docs/PRODUCTION-CUTOVER.md`. Same adapter.

## Fail count for VP5

- Journey rows claiming success on non-2xx: **0** after rescore  
- Failed steps (honest): **4** (listed above)  
- ROUTE_ONLY / pending live re-run: uk_annual, fp_annual, other_income, losses, bsas_adjust, se_amend, final_calc  
