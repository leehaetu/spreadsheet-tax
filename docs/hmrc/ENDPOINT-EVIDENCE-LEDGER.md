# Endpoint evidence ledger

**Rule:** Route existence is not HMRC proof. Only rows with real HTTP status from HMRC sandbox (or explicit preview) may be cited.  
**Tags:** `ROUTE_ONLY` · `UNIT_TESTED` · `SANDBOX_HTTP` · `CUSTOMER_WORKFLOW` · `PROD_APPROVED` · `LISTED`  
**Updated:** 2026-07-18  

Non-2xx is **fail**, never “okish”.

| Capability | API | Product workflow | Request source | Latest HTTP | HMRC code | Error/token cases | Test pointer | Tag |
|------------|-----|------------------|----------------|-------------|-----------|-------------------|--------------|-----|
| OAuth token | OAuth | `/connect-hmrc` | sandbox test user | see journey | — | expired mock blocked | e2e oauth | `SANDBOX_HTTP` + `CUSTOMER_WORKFLOW` |
| Business Details list | Business Details 2.0 | App fill IDs · year-end | live product | see `sandbox-journey-run.json` | — | 401 without token | mtd journey | `SANDBOX_HTTP` |
| Obligations I&E | Obligations 3.0 | App show due periods | live product | journey | — | — | mtd journey | `SANDBOX_HTTP` |
| SE period create | SE Business 5.0 | `/app` submit / mtd | fixture draft | journey | — | empty body blocked | unit + journey | `SANDBOX_HTTP` |
| SE period retrieve | SE 5.0 | readback | periodId | journey | — | taxYear path required | unit paths | `SANDBOX_HTTP` |
| SE period amend | SE 5.0 | year-end correction | periodId | ROUTE + workflow API | — | needs live token | workflows | `ROUTE_ONLY` / preview `CUSTOMER_WORKFLOW` |
| UK property period | Property 6.0 | `/app` multi-source | fixture | journey (record exact) | — | 429 throttle possible | journey | `SANDBOX_HTTP` when 2xx |
| Foreign property period | Property 6.0 | `/app` | fixture | journey | — | def2 body | unit property | `SANDBOX_HTTP` |
| Calculations trigger | Calcs 8.0 | year-end · mtd | — | journey | — | — | journey | `SANDBOX_HTTP` |
| Final declaration obligations | Obligations | year-end | — | journey | — | — | journey | `SANDBOX_HTTP` |
| SE annual | SE 5.0 | year-end se_annual | default body | journey | — | empty body fixed | unit + journey | `SANDBOX_HTTP` |
| UK/foreign annual | Property 6.0 | year-end | — | ROUTE | — | — | — | `ROUTE_ONLY` until ledger 2xx |
| BSAS trigger | BSAS 7.0 | year-end | — | journey | — | — | journey | `SANDBOX_HTTP` |
| BSAS adjust | BSAS 7.0 | year-end / mtd | — | ROUTE | — | — | — | `ROUTE_ONLY` |
| Brought-forward losses | Individual Losses | year-end losses | — | ROUTE | may 403 if unsubscribed | — | — | `ROUTE_ONLY` |
| Tax liability adjustments | TLA | mtd | — | ROUTE | may 403 | — | — | `ROUTE_ONLY` |
| ITSA status | Individual Details 2.0 | mtd / extras | — | journey | — | — | journey | `SANDBOX_HTTP` |
| BISS | BISS 3.0 | mtd | — | journey | — | — | journey | `SANDBOX_HTTP` |
| Accounts balance | Accounts 4.0 | mtd | onlyOpenItems | journey (record exact) | — | query params | unit + journey | varies |
| FPH validate | Test FPH 1.0 | integrity | honest omit | often 422 INVALID | INVALID_HEADERS | never invent | fraud tests | honest fail |
| Create test business | Test Support | sandbox setup | — | 400 already-added common | RULE_PROPERTY_BUSINESS_ADDED | not customer | journey | setup only |

## How to update

1. Run product workflow or Playwright journey against sandbox.  
2. Paste **exact** status and HMRC `code` into a new dated note under `docs/hmrc/` or refresh `sandbox-journey-run.json`.  
3. Change tag only when evidence matches.  
4. Never mark success on non-2xx.

## Production cutover (config only)

| Item | Config |
|------|--------|
| Host | `HMRC_OAUTH_ENV=production` → `api.service.hmrc.gov.uk` |
| Credentials | Production client id/secret |
| Redirect | Same path registered on Production app |
| Live flag | `HMRC_ALLOW_LIVE_SUBMIT=1` + signed-in non-mock token |
| Safety | `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, `COOKIE_SECURE=1` |

After HMRC grants Production: configure + controlled verify — no feature rewrite planned.
