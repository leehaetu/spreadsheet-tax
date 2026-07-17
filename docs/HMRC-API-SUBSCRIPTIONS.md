# HMRC API subscriptions — Spreadsheet Tax (verified)

Research date: 2026-07-17  
Sources: HMRC Developer Hub Self Employment Business (MTD) 5.0, Property Business (MTD) 6.0, Income Tax MTD end-to-end service guide, Test Fraud Prevention Headers API.

## Your Sandbox application (confirmed subscribed)

| Name | Need for Spreadsheet Tax |
|------|--------------------------|
| **Self Employment Business (MTD) 5.0** | **Required** — period submit SE |
| **Property Business (MTD) 6.0** | **Required** — UK + foreign period submit |
| **Business Details (MTD) 2.0** | **Required** — list business IDs (in-year product) |
| **Obligations (MTD) 3.0** | **Required** — due periods (in-year product production access) |
| **Test Fraud Prevention Headers 1.0** | **Required** — header QA (legal requirement on MTD APIs) |
| **Self Assessment Test Support (MTD) 1.0** | **Required** — sandbox data |
| **Create Test User 1.0** | **Required** — sandbox individuals |
| **Hello World 1.0** | **Useful** — prove Hub credentials (connectivity only) |
| **Business Income Source Summary (MTD) 3.0** | Optional — read summaries later |
| **Business Source Adjustable Summary (MTD) 7.0** | Optional — after quarters (BSAS journey) |
| **Individual Calculations (MTD) 8.0** | Optional — tax calculation later |

**Verdict: you have everything required for the bridging MVP + a sensible pilot set.**  
Optional extras (BISS, BSAS, Calculations) are fine to keep; they are not needed for first period submit.

## Verdict: core product APIs

| Subscribe? | API | Version on Hub | Why |
|------------|-----|----------------|-----|
| **YES — required** | **Self Employment Business (MTD)** | **5.0 (beta)** | Create/amend SE period summaries. Matches our path `/individuals/business/self-employment/{nino}/{businessId}/period` |
| **YES — required** | **Property Business (MTD)** | **6.0 (beta)** | **One API covers both UK and foreign.** Paths: `/individuals/business/property/uk/.../period/{taxYear}` and `.../foreign/.../period/{taxYear}` — confirmed in HMRC OAS / e2e guide |
| **YES — sandbox QA** | **Test Fraud Prevention Headers** | **1.0** | HMRC requires fraud headers by law on SE + Property APIs; this test API validates header pack in sandbox |
| **YES — sandbox setup** | **Self Assessment Test Support (MTD)** | current | Delete/setup stateful sandbox data for MTD journeys |
| **YES — sandbox setup** | **Create Test User** | current | Create individual test users + NINO for OAuth and submits |
| **YES — required (in-year product)** | **Business Details (MTD)** | 2.0 | List businesses → real business IDs (`GET /api/hmrc/businesses`) |
| **YES — required (in-year product)** | **Obligations (MTD)** | 3.0 | Open period / due dates (`GET /api/hmrc/obligations`) |

Beta versions are normal for MTD IT APIs on the Hub. Prefer the **highest stable-listed beta that matches the e2e guide** (SE **5.0**, Property **6.0**). Do not pick an older 1.0 beta for the same product name if 5.0/6.0 are listed.

## Do NOT subscribe for MVP (unless you expand scope)

| API | Why not now |
|-----|-------------|
| **Agent Authorisation 1.0 / 2.0** | Individual taxpayer OAuth first. Agents = separate product path later |
| **Agent Authorisation Test Support** | Only when building agent flow |
| **Individual Losses 6.0 / 7.0** | Loss claims — not period quarterly bridging |
| **National Insurance Test Support** | Optional; Create Test User usually enough for NINO |
| **Individual PAYE Test Support** | PAYE, not ITSA property/SE period bridging |
| **Marriage Allowance Test Support** | Out of scope |
| **Hello World** | Optional connectivity smoke test only — not required |
| **Check an EORI Number** | Customs/VAT-ish — **not** our product |
| **MTD VAT APIs** | Wrong tax regime |

## Fraud prevention is not a “business” API subscription only

Fraud prevention data is **HTTP headers on every SE/Property request** (required by law).  
Subscribe to **Test Fraud Prevention Headers** so we can validate headers in sandbox.  
We already emit a WEB_APP_VIA_SERVER pack in code (`src/lib/fraud-headers.js`).

## OAuth scopes

```
write:self-assessment
read:self-assessment
```

## Accept headers (code)

- SE: `Accept: application/vnd.hmrc.5.0+json`
- Property: `Accept: application/vnd.hmrc.6.0+json`

## Application form fields (copy/paste)

### Application description

```
Spreadsheet Tax is bridging-only software for Making Tax Digital for Income Tax. It maps period figures from a customer's existing spreadsheet into HMRC-compatible quarterly updates for self-employment, UK property and foreign property. Users review mapped figures before submission. The software is not a full double-entry ledger. Sandbox integration uses individual OAuth (authorization code). Production live filing remains gated until HMRC production approval and operator controls are complete. Intellectual property: Lee Hine.
```

### Privacy policy URL

```
https://spreadsheet-tax-production.up.railway.app/privacy
```

### Terms and conditions URL

```
https://spreadsheet-tax-production.up.railway.app/terms
```

### Redirect URI

```
https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback
```

## Credentials

Set on Railway (not in git): `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`, `HMRC_REDIRECT_URI`, `HMRC_OAUTH_ENV=sandbox`, `HMRC_OAUTH_MOCK=0`. Keep `HMRC_ALLOW_LIVE_SUBMIT=0` until first successful sandbox connect + header validation.
