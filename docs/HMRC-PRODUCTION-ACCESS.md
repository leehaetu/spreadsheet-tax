# HMRC Production API access — operator pack

**Product:** Spreadsheet Tax (in-year bridging — quarterly updates)  
**Owner:** Lee Hine  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Date:** 2026-07-17  

**Rule:** This pack is evidence and process. It does **not** grant production APIs by itself. HMRC must approve after you create a Production application and return their checklist.

Official guide: [How to integrate — process for Production access](https://developer.service.hmrc.gov.uk/guides/income-tax-mtd-end-to-end-service-guide/documentation/how-to-integrate.html#process-for-being-granted-production-access).

---

## 1. Product classification (honest)

| Item | Value |
|------|--------|
| Product type | **In-year product** (quarterly updates / bridging) |
| Not claiming | Full end-to-end SA replacement, agent multi-client live filing, billing |
| Digital records | Customer keeps books in their spreadsheet; we **digitally link** by mapping a period file they upload |
| Tax liability estimate | **Signpost** to HMRC online account — we do **not** display an in-software tax calculation |
| Live filing | **Not enabled** for real taxpayers until Production credentials + launch gate |

---

## 2. APIs required for in-year product

| API | Hub version (sandbox) | Our use | Sandbox tested? |
|-----|----------------------|---------|-----------------|
| Self Employment Business (MTD) | 5.0 | Create SE period summary | **Yes** — 200 + periodId from fixture CSV |
| Property Business (MTD) | 6.0 | UK + foreign period | Payload built + request shape unit-tested; full sandbox submit optional |
| Business Details (MTD) | 2.0 | List business IDs | **Yes** — list returned `XBIS12345678901` |
| Obligations (MTD) | 3.0 | Open periods | Code path live (`GET /api/hmrc/obligations`); run after OAuth connect |
| Individual Calculations (MTD) | — | **Not used** | Signpost to HMRC account instead |
| Test Fraud Prevention Headers | 1.0 | Validate FPH | **Yes** — honest pack; may be `POTENTIALLY_INVALID_HEADERS` (MFA) |

Optional later (end-of-year, not this gate): BSAS, Losses, Tax Liability Adjustments, Final declaration.

---

## 3. What you do on Developer Hub (only you can)

1. Sign in to [HMRC Developer Hub](https://developer.service.hmrc.gov.uk/api-documentation).
2. Confirm **Sandbox** app still has the subscriptions in [HMRC-API-SUBSCRIPTIONS.md](./HMRC-API-SUBSCRIPTIONS.md).
3. **Create a Production application** (or add subscriptions to an existing Production app).
4. Privacy / terms / redirect (same product URLs):

```
Privacy: https://spreadsheet-tax-production.up.railway.app/privacy
Terms:   https://spreadsheet-tax-production.up.railway.app/terms
Redirect (Production when ready):
https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback
```

5. After sandbox testing is complete, email **SDSTeam@hmrc.gov.uk** with:
   - Sandbox **application ID** used for testing
   - That testing is complete and they should review logs / fraud headers
6. Complete the **Production Approvals Checklist** HMRC issues and return it.
7. When approved, store Production `client_id` / `client_secret` only on Railway (never git). Set `HMRC_OAUTH_ENV=production` only after gate decision.

---

## 4. Sandbox evidence already proven

| Proof | Detail |
|-------|--------|
| Application token | Client credentials → sandbox token |
| Hello World | Application-restricted 200 |
| Create Test User | Individual + NINO (example used in pilot: `TB116925D`) |
| User OAuth | Playwright → `test-www.tax.service.gov.uk` grant → `connected: true`, `mock: false` |
| Business Details | List → businessId `XBIS12345678901` |
| SE period POST | Fixture `test-spreadsheets/01-self-employment-plumber.csv` → HTTP **200**, `periodId: 2024-04-06_2024-07-05` |
| FPH | Honest omit; validate endpoint exercised; **no invented** public port / screens / vendor IP |

**Always state:** SE submit used a **fixture** spreadsheet and **sandbox** identity — not a live customer filing.

See also: [HMRC-FPH-AND-SANDBOX-SUBMIT.md](./HMRC-FPH-AND-SANDBOX-SUBMIT.md), [HMRC-SANDBOX-PILOT.md](./HMRC-SANDBOX-PILOT.md), [TRUTH-AUDIT.md](./TRUTH-AUDIT.md).

---

## 5. Fraud prevention — what to tell HMRC

Connection method: **WEB_APP_VIA_SERVER**.

| Topic | Honest statement |
|-------|------------------|
| Public port | Browser cannot observe client public TCP port over TLS. We send `Gov-Client-Public-Port` **only** if a trusted proxy provides a real port. Otherwise **omitted**. |
| Screens / timezone | Only from browser JS headers when present — never defaulted to invented values. |
| Multi-factor | Password-only auth today → **omit** Multi-Factor header until MFA is implemented. |
| Vendor public IP | Set via `VENDOR_PUBLIC_IP` env when Railway egress IP is known; otherwise omitted (not copied from client IP). |
| Past mistake | An earlier build invented public port for green validate; **removed**. Policy is incomplete-but-true. |

HMRC missing-header guidance: [getting it right — missing header data](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/getting-it-right/#missing-header-data).

---

## 6. Email draft to SDSTeam (copy/adapt)

```
Subject: Spreadsheet Tax — sandbox testing complete, request Production review

Hello SDSTeam,

Software name: Spreadsheet Tax
Product type: In-year MTD for Income Tax bridging (quarterly updates from customer spreadsheets)
Developer: Lee Hine
Privacy: https://spreadsheet-tax-production.up.railway.app/privacy
Terms: https://spreadsheet-tax-production.up.railway.app/terms
Redirect URI: https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback

Sandbox application ID: [PASTE FROM HUB]
APIs tested (sandbox): Self Employment Business 5.0, Business Details 2.0, Test Fraud Prevention Headers 1.0, Create Test User, Obligations 3.0 (in progress / done as applicable), Property Business 6.0 (payload + path).

Evidence summary:
- Real user-restricted OAuth grant in sandbox
- Business Details list successful
- SE period summary create returned 200 with periodId (fixture data)
- Fraud prevention: WEB_APP_VIA_SERVER, honest omission of unobtainable fields (no invented public port)

We will complete the Production Approvals Checklist when issued.
Please advise next steps for Production access review.

Regards,
Lee Hine
```

---

## 7. Railway env after Production approval

| Variable | Sandbox now | Production after approval |
|----------|-------------|---------------------------|
| `HMRC_CLIENT_ID` / `SECRET` | Sandbox app | **New** Production credentials |
| `HMRC_OAUTH_ENV` | `sandbox` | `production` |
| `HMRC_OAUTH_MOCK` | `0` | `0` |
| `HMRC_ALLOW_LIVE_SUBMIT` | `1` only for controlled sandbox | Only after launch gate for live |
| `HMRC_REDIRECT_URI` | production URL callback | same, registered on Production app |
| `VENDOR_PUBLIC_IP` | set when known | set |

**Do not** put Production secrets in git or CI logs.

---

## 8. MVP definition vs Production APIs

| Goal | Meaning |
|------|---------|
| **MVP complete (product)** | Upload → map → review → draft → connect HMRC → sandbox submit → receipt/history; honest UI; Railway live |
| **Production APIs gained** | HMRC grants Production credentials after checklist + FPH + sandbox evidence — **Hub/process**, not only code |

Both are required for real taxpayer live filing. This document tracks the second.

---

## 9. Checklist (Lee)

- [ ] Confirm Obligations (MTD) 3.0 subscribed on Sandbox app
- [ ] Connect sandbox OAuth → Load businesses → Load obligations on `/app`
- [ ] Optional: UK/foreign property sandbox period submit if HMRC requires endpoint logs
- [ ] Set `VENDOR_PUBLIC_IP` if Railway egress IP known
- [ ] Create Production application on Hub
- [ ] Email SDSTeam with sandbox application ID
- [ ] Return Production Approvals Checklist
- [ ] Store Production secrets on Railway only after approval
- [ ] Keep `HMRC_OAUTH_ENV=sandbox` until go-live decision
