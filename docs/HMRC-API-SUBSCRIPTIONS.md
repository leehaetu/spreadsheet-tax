# HMRC API subscriptions — Spreadsheet Tax (verified)

**Last confirmed (Hub):** 2026-07-18  
**Sandbox application ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`  
**Product code:** all of these are wired under `/api/hmrc/mtd/*` + `/mtd` UI (except Hello/Create Test User/Test Support which are setup paths).

## Your Sandbox application — fully subscribed set

| Name | Version | Product use |
|------|---------|-------------|
| **Self Employment Business (MTD)** | 5.0 | SE period + annual |
| **Property Business (MTD)** | 6.0 | UK + foreign period + annual |
| **Business Details (MTD)** | 2.0 | List/retrieve businesses, periods of account |
| **Obligations (MTD)** | 3.0 | I&E + crystallisation obligations |
| **Individual Calculations (MTD)** | 8.0 | In-year + intent-to-finalise triggers |
| **Business Source Adjustable Summary (MTD)** | 7.0 | BSAS trigger/list/retrieve/adjust |
| **Business Income Source Summary (MTD)** | 3.0 | BISS readback |
| **Self Assessment Individual Details (MTD)** | 2.0 | ITSA status |
| **Self Assessment Accounts (MTD)** | 4.0 | Balance and transactions |
| **Self Assessment Assist (MTD)** | 1.0 | HMRC Assist report (messages) after calculation |
| **Test Fraud Prevention Headers** | 1.0 | FPH validation |
| **Self Assessment Test Support (MTD)** | 1.0 | Create test businesses (sandbox) |
| **Create Test User** | 1.0 | Sandbox individuals |
| **Hello World** | 1.0 | Connectivity smoke |

**Verdict:** Hub subscriptions now match a **full end-to-end bridging** claim (in-year + EOY/BSAS + extras).  
Still **not** Agent Authorisation / EOPS (out of product scope).

## Code mapping

| Hub API | Our endpoints |
|---------|----------------|
| Business Details | `GET /api/hmrc/mtd/businesses`, periods-of-account |
| Obligations | `.../obligations/ie`, `.../obligations/final-declaration` |
| SE Business | `.../period/se`, annual SE |
| Property Business | `.../period/uk`, `.../period/foreign`, annual UK/foreign |
| Individual Calculations | `.../calculations/trigger`, list, retrieve, final |
| BSAS | `.../bsas/*` |
| BISS | `.../biss` |
| Individual Details | `.../itsa-status` |
| Accounts | `.../accounts/balance?onlyOpenItems=true` |
| Self Assessment Assist | `POST /api/hmrc/mtd/assist/report`, `POST /api/hmrc/mtd/assist/acknowledge` · workflows `sa_assist_report` / `sa_assist_acknowledge` |
| Test Support | `POST /api/hmrc/mtd/test-business` |
| FPH Test | `POST /api/hmrc/validate-fraud-headers` |
| Create Test User | `POST /api/hmrc/create-test-user` |

## Production

When Production credentials are granted: subscribe the **same set** on the Production application, set Railway `HMRC_CLIENT_ID`/`SECRET` + `HMRC_OAUTH_ENV=production`. No code fork required.

## OAuth scopes

```
write:self-assessment
read:self-assessment
read:self-assessment-assist
write:self-assessment-assist
```

## Redirect / legal URLs

```
https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback
https://spreadsheet-tax-production.up.railway.app/privacy
https://spreadsheet-tax-production.up.railway.app/terms
```
