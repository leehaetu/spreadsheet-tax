# Plan: Spreadsheet Tax → HMRC Recognised (full bridging software)

**Owner:** Lee Hine  
**Product:** Spreadsheet Tax only  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Sandbox application ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`  
**Production application:** not yet (create only when sandbox journey is complete)  
**Goal label:** **HMRC Recognised**  
**Truth today:** product is **not yet** HMRC-recognised — UI says so until HMRC grants it  

Roadmap source: [MTD ITSA vendor API roadmap](https://developer.service.hmrc.gov.uk/roadmaps/mtd-itsa-vendors-roadmap/documentation/apis.html)

---

## 1. What HMRC are asking for (plain English)

| They want | What we do |
|-----------|------------|
| **Full working software** in **sandbox** | End-to-end journeys in the real web app, not half-demo |
| Every API you want on Production **proven working** | Call each endpoint from software (and monitor in Postman if needed) |
| Fraud prevention headers correct | On every MTD call; honest omit if data missing |
| **Production Approvals Checklist** in their Word format | One form when ready — they match it to **their logs** |
| After Production credentials | Flip env to production hosts/credentials — same app |

**Not required as official gate:** homemade JSON “packs”.  
**Official gate:** checklist form + sandbox API logs + FPH.

**No EOPS** (End of Period Statement journey) — out of product plan.

---

## 2. Product end-state (definition of “complete web app”)

### 2.1 In-year (quarterly bridging) — **must work first**

| Capability | APIs | UI |
|------------|------|-----|
| Connect HMRC (individual OAuth) | OAuth | `/connect-hmrc` |
| List businesses | Business Details 2.0 | App + workspace |
| Open obligations (I&E) | Obligations 3.0 | App |
| Import spreadsheet → draft | (ours) | `/app` |
| Submit SE period (create/amend + retrieve) | Self Employment Business 5.0 | App |
| Submit UK property period + retrieve | Property Business 6.0 | App |
| Submit foreign property period + retrieve | Property Business 6.0 | App |
| Tax estimate | Individual Calculations 8.0 **or** signpost HMRC | Prefer **in-app calc** for “full” product |
| Errors, history, export | ours | History |
| FPH on all MTD calls | Test FPH 1.0 | Integrity |

### 2.2 End-of-year — **required for “full” HMRC ask**

| Capability | APIs |
|------------|------|
| Periods of account / late accounting date / accounting type (as required) | Business Details 2.0 |
| Annual submissions SE + UK + foreign | SE Business 5.0 / Property 6.0 |
| BSAS trigger, retrieve, adjust, list | Business Source Adjustable Summary 7.0 |
| Losses create/submit as required | Individual Losses (current) |
| Tax liability adjustments if required | Individuals Tax Liability Adjustments |
| Final declaration obligations | Obligations 3.0 |
| Trigger intent-to-finalise / final-declaration | Individual Calculations 8.0 |
| Final declaration statements in UI (wording per e2e guide) | UI copy locked to HMRC text |

### 2.3 Strong bridging extras (subscribe + implement if already on Hub)

| Capability | APIs | Why |
|------------|------|-----|
| ITSA / mandation status | Self Assessment Individual Details 2.0 | Know if customer is MTD |
| Income source summary | BISS 3.0 | Readback confidence |
| Balance / charges / penalties (where useful) | Self Assessment Accounts 4.0 | Customer position |
| Hello / Create Test User / Test Support | setup only | Sandbox |

### 2.4 Roadmap items **already usable** (pull in when building, don’t wait for Sep)

From roadmap “already released” / June 2026 sandbox:

| Item | When to add |
|------|-------------|
| Obligations due-date alignment (7th) | In-year obligations UI |
| Foreign multi-property same country | Foreign property mapping |
| Business Details accounting type in-year | EOY / settings |
| SE Class 4 NICs adjustment field | Annual SE |
| Accounts penalties retrieve | Optional accounts panel |
| Partner income / calc enhancements | Only if we support those customers |

### 2.5 September 2026+ (plan slots, implement when sandbox stable)

Writing-down / first-year allowances, revenue amendments display, errors & corrections, appeals/standovers, other UK income fields — **track in roadmap notes**; implement when endpoints are documented and in our scope.

---

## 3. Phases to HMRC Recognised

```text
P0  FOUNDATION (now)     Secure app, honesty, Railway, sandbox credentials
P1  IN-YEAR COMPLETE     Full quarterly bridging operational in sandbox
P2  EOY + BSAS           Full end-of-year journey operational in sandbox
P3  EXTRAS + HARDENING   Individual Details, BISS, Accounts, FPH green as far as honest
P4  CHECKLIST + LOGS     One SDSTeam package: checklist form + sandbox app ID
P5  PRODUCTION APIS      Create Production app, get credentials, switch env
P6  HMRC RECOGNISED      Listing / recognition process after Production access
```

### P0 — Foundation (mostly done)

- [x] Live Railway app, volume DB, auth, drafts  
- [x] Sandbox Hub app + subscriptions  
- [x] Honest FPH policy + “not yet recognised” UI  
- [x] Sandbox app ID known  
- [ ] Postman collection for monitoring (this plan ships setup)  
- [ ] Operator runbook: how Lee sees every call  

### P1 — In-year complete (sandbox) — **IMPLEMENTED (routes + /mtd UI)**

API surface under `/api/hmrc/mtd/*` + operator UI `/mtd`:

1. OAuth — existing `/connect-hmrc`  
2. Business Details list/retrieve  
3. I&E obligations  
4. SE period create / retrieve / amend  
5. UK + foreign property period create / retrieve  
6. Draft-linked period submit from History draft IDs  
7. Calculations trigger (in-year) / list / retrieve  
8. Capability matrix `GET /api/hmrc/mtd/capabilities`  

**Exit P1 (ops):** Connect sandbox → `/mtd` → list businesses → obligations → import on `/app` → submit periods → calcs. Logs hit sandbox app.

### P2 — End-of-year + BSAS (sandbox) — **IMPLEMENTED (routes + /mtd UI)**

1. Crystallisation / final-declaration obligations  
2. Annual PUT SE / UK / foreign  
3. BSAS trigger, list, retrieve SE/UK/foreign, SE adjust  
4. Brought-forward losses create/list  
5. Tax liability adjustments create  
6. Periods of account GET/PUT  
7. Intent-to-finalise calculation trigger  

**Exit P2 (ops):** Run P2 buttons on `/mtd` with valid sandbox stateful data (may need 4 periods + annual for full BSAS stateful journey).

### P3 — Extras + hardening — **IMPLEMENTED (core APIs + /mtd)**

1. ITSA status (Individual Details path)  
2. BISS retrieve  
3. Accounts balance-and-transactions  
4. FPH still on every `hmrcFetch` (honest omit)  
5. Security launch gate remains open for public pilot (separate)  

### P4 — Checklist + one SDSTeam send

1. Fill **Software-Approvals-Production-Checklist** (their format) as **Full End to End** (or In-Year then EOY in two iterative approvals if we split)  
2. Email: sandbox ID `e6751be5-fd22-4447-9e77-aa51729b1b46` + testing complete  
3. They review **logs + FPH + checklist**  
4. No chase spam  

**Recommended claim for first Production ask once P2 done:**  
**Full End to End product** (in-year + EOY) — matches “full working software”.  
If time-boxed: iterative **In-Year first**, then second checklist for EOY.

### P5 — Production APIs

1. Create Production application on Hub  
2. Subscribe same APIs  
3. Production credentials on Railway only  
4. `HMRC_OAUTH_ENV=production`, new redirect registered  
5. Smoke test with real pilot (controlled)  

### P6 — HMRC Recognised listing

1. Complete any “recognised software” / vendor listing steps HMRC require after Production  
2. Flip `HMRC_RECOGNISED_SOFTWARE = true` in code **only when listed**  
3. Marketing may then say **HMRC Recognised**  

Until P6: UI goal language = “**Building toward HMRC Recognised** · **Not yet recognised**”.

---

## 4. Build type decision (locked for this plan)

| Option | When |
|--------|------|
| In-year only first Production | Faster, then second approval for EOY |
| **Full end-to-end one shot** | Matches “full working software now” ask |

**Plan default:** build **P1 then P2 fully in sandbox**, then **one Full End to End** checklist send.  
Do **not** create Production app until P1+P2 exit.

---

## 5. Postman (monitoring FPH + APIs)

Postman is a **third-party HTTP client**. You do **not** need to give me a login if you can:

1. Install [Postman](https://www.postman.com/downloads/)  
2. Import files from `docs/postman/` in this repo  
3. Paste client id/secret into the environment (local only — never commit)

See **`docs/postman/README.md`**.

What Postman is good for:

- Application token, create test user  
- User token (after browser OAuth)  
- Business Details, Obligations, SE/Property period, FPH validate  
- Inspect **request headers** (FPH) and response bodies  

What Postman cannot do alone:

- HMRC browser login/consent (use our Playwright e2e or manual browser)  

Optional later: Postman account login so collections sync — **not required** for setup.

---

## 6. Environment switch (sandbox → production)

| Variable | Sandbox now | After Production grant |
|----------|-------------|-------------------------|
| `HMRC_CLIENT_ID/SECRET` | Sandbox app | Production app |
| `HMRC_OAUTH_ENV` | `sandbox` | `production` |
| `HMRC_REDIRECT_URI` | live callback | same URL registered on Production app |
| API host | `test-api.service.hmrc.gov.uk` | `api.service.hmrc.gov.uk` |

App code stays; credentials and host flip.

---

## 7. Honesty / “HMRC Recognised” wording

| Place | Wording now |
|-------|-------------|
| Goal / plan / tasks | **HMRC Recognised** (destination) |
| Live product UI | **Building toward HMRC Recognised · Not yet HMRC-recognised** |
| After listing | **HMRC Recognised** |

Never set recognised true in code before grant.

---

## 8. Success criteria (go / no-go)

**Ready for SDSTeam checklist send when:**

- [ ] P1 journeys unaided in sandbox  
- [ ] P2 journeys unaided in sandbox (if full E2E claim)  
- [ ] Every API on the checklist has recent sandbox traffic from the software  
- [ ] FPH policy documented; validate endpoint exercised  
- [ ] Checklist form filled accurately  
- [ ] Production app **still not required until they ask / after approval path**  

**HMRC Recognised when:**

- [ ] Production access granted  
- [ ] Listing/recognition steps complete  
- [ ] Code flag flipped  

---

## 9. Immediate next engineering slice (execute after this plan)

1. Postman import working for Lee (this PR)  
2. Property sandbox submit HTTP proof + UI  
3. Retrieve period summaries after create  
4. Wire obligations → period dates into submit form  
5. Individual Calculations in-app **or** keep signpost until P1 close  
6. Then EOY/BSAS module scaffold  

---

## 10. Out of scope

- EOPS  
- Agent multi-client Production as first gate  
- Inventing FPH  
- Claiming recognised before grant  
- Paying ads / full SEO empire  

---

**One sentence:**  
Build a **complete sandbox MTD bridging web app** (in-year + end-of-year + BSAS + agreed extras), prove every API in **logs**, return **one checklist**, get **Production APIs**, switch env, then become **HMRC Recognised**.
