# Product finish plan — HMRC MTD ITSA bridging app

**Owner bar:** Make Spreadsheet Tax look and behave like a finished HMRC MTD ITSA **bridging** app — not a prototype, sandbox demo, or developer tool.  
**Sources:** Owner goal (2026-07-18), scorecard of last 10 instruction chats, `docs/PRODUCT-BOARD-SPEC.md`, `docs/AGENT-TRUTH-PROTOCOL.md`.

---

## Goal statement

Clean up the **authenticated product** so the customer path is:

**Sign in → consistent shell → HMRC connect → load income sources from HMRC → quarterly (one source) → upload → check → review/send → year-end guided path → history / settings**

No customer-facing sandbox/practice/preview/demo/sample/fictional wording.  
No create/replace HMRC businesses in-app.  
No jump-scroll workflows.  
Same shell on every authenticated page.

**Not claimed by this plan alone:** capacity 200×800k, HMRC Recognised listing, production HMRC credentials, full pen-test.

---

## Scope (customer-facing product)

| In scope | Out of scope (separate shells) |
|----------|--------------------------------|
| `/signin`, `/home`, `/onboarding`, `/connect-hmrc`, `/app`, `/year-end`, `/records`, `/history`, `/account`, `/guide` | `/workspace` practice, `/mtd` operator harness, `/admin`, sales marketing “practice firm” copy |

---

## Work packages

### P0 — App shell & sign-in
- [x] Shared `product-shell.js` nav + connection + account  
- [x] No authenticated chrome on `/signin`  
- [x] Same nav labels/icons/shell on product pages  
- [x] Suppress mode-pill “HMRC sandbox / preview” on product pages (`site-chrome.js`)

### P1 — Copy hygiene (product only)
- [x] Strip customer theatre strings from product pages (guarded by `tests/product-finish.test.js`)  
- [x] Operator tools only behind operator gate on connect-hmrc  
- [x] Nav labels: Home · Quarterly updates · Year end · Sources · History · Settings · Help  

### P2 — HMRC setup & gating
- [x] Onboarding: NINO + Connect + Load businesses from HMRC (mirror only)  
- [x] Hard gate: quarterly cannot start without HMRC connected  
- [x] No create/add/remove HMRC sources in customer UI  
- [x] Missing business → `/guide` + HMRC guidance  
- [x] Taxpayer `/connect-hmrc` is **individual-only** (no “Connect as agent” on customer path)  
- [x] Home disconnected: primary CTA Connect HMRC; no actionable local sources until connected  
- [x] Sidebar “Connected” only when real non-mock, non-expired HMRC token is stored  

### P3 — Quarterly guided flow
- [x] Source → upload → map/check → review/send as exclusive panels  
- [x] Upload copy: “Click to choose a spreadsheet or drag it here”  
- [x] Download free template labelled  
- [x] Spreadsheet inspect in modal  
- [x] Technical IDs / Fill business IDs / Show due periods removed from primary path  
- [x] Quarter-focused copy before upload; YTD off main path  

### P4 — Year end
- [x] Label “Year end” not Tax return  
- [x] Exclusive multi-step questionnaire (q1–q4) → checklist → stage work → done  
- [x] Hard HMRC connection gate on year-end  
- [x] No “connection mode remains visible…” filler  
- [x] Checklist board + sequential stage work with prev/continue  

### P5 — Records / History / Settings
- [x] History = Submission history  
- [x] Records = Sources shell  
- [x] Settings in product shell  
- [x] Clearer IA (sources + drafts with role)  
- [x] Technical business IDs under Settings advanced disclosure  

### P6 — Assist (customer-visible)
- [x] SA Assist generate + acknowledge `SANDBOX_HTTP` (API evidence ledger)  
- [x] HMRC wording only in Assist renderer  
- [x] **Year-end dedicated stage** `hmrc_assist` — “HMRC Assist feedback” on checklist + work UI  
- [x] Primary CTA **Get HMRC Assist report** on that stage; messages render in-stage  
- [x] Quarterly: primary path is **Open year-end for HMRC Assist** (Assist is post-calculation)  
- [x] Advanced calc-reference only if customer already has a calculation ID  

### P7 — Proof
- [x] Unit tests: `tests/product-finish.test.js`  
- [x] Playwright product-finish checklist: `tests/e2e/product-finish.spec.js` (mocked HMRC connection for UI gates only — **not** SANDBOX_HTTP)  
- [x] Combined product e2e pack green (product-finish + taxpayer-overhaul + app-journey + smoke) with single worker + `E2E_RELAX_RATE_LIMIT`  
- [ ] Optional owner browser pass on real sandbox credentials (external)  

---

## Test plan (owner / automated)

| # | Check | Automated |
|---|--------|-----------|
| 1 | Sign in: no dashboard chrome | e2e product-finish + unit |
| 2 | Shell consistent on product pages | e2e product-finish |
| 3 | No sandbox/preview theatre on product pages | unit product-finish |
| 4 | HMRC disconnected: quarterly + year-end blocked | e2e product-finish |
| 5 | Onboarding: load-only, no create | unit + e2e |
| 6 | Quarterly exclusive steps + upload/template | e2e product-finish + taxpayer-overhaul |
| 7 | Year-end exclusive questions → checklist → work | e2e product-finish + taxpayer-overhaul |
| 8 | Template download | e2e smoke |

---

## Assumptions

1. Bridging app first (spreadsheet → HMRC), not full books.  
2. Mirror HMRC sources only.  
3. HMRC connection before quarterly and year-end.  
4. Production-facing UI never sells itself as sandbox/demo.  
5. Main quarterly path = current period figures.  
6. Boards = visual direction; HMRC-mirror overrides create-business frames.

---

## Scorecard lessons (last 10 chats) → rules for this plan

| Lesson | Rule here |
|--------|-----------|
| Partial UX sold as done | Work packages must close with tests + checklist |
| Wrong job (artifacts) | Product code only |
| Assist finished with real sandbox | Keep Assist HMRC-only; don’t invent messages |
| Board 100% not met | Explicit open items; still ship hard gates + shell |

---

## Implementation status (this pass)

1. Plan doc (this file) — done  
2. Shell + sign-in + suppress product mode-pill — done  
3. Hard HMRC gate on quarterly **and** year-end — done  
4. Product copy strip + upload wording — done  
5. Year-end exclusive multi-card guided flow + checklist + work/done — done  
6. Settings advanced IDs + Assist primary CTA polish — done  
7. Automated unit + Playwright product-finish checklist — done  

**Improvements closed in follow-up pass:** history table + recovery honesty; home next-task by connection state; quarterly/year-end tax-year chrome; declaration/adjustments copy; connect-HMRC status without mock theatre.

**Improvements closed in owner-complaint pass (2026-07-18):** individual-only Connect HMRC; disconnect only when connected; home defaults + source list honesty while disconnected; shell connection label trusts only real HMRC tokens (no oauthConnected shortcut).

**Closeout pass (2026-07-18):** customer API labels Connected/Not connected only (no “HMRC sandbox connected”); Settings + Sources honesty; quarterly spreadsheet check off main path (modal viewer); Playwright workers=1 + E2E login rate-limit relax. Evidence: unit 284/284; product e2e pack 20/20.

**Customer product-finish bar:** automated checklist green; Assist now a year-end step with calc wiring in **1.34.3**.  
**Closeout 1.34.3:** calcId extract/store; Continue to Assist; 204 empty Assist state; quarterly one-source filter; BSAS advanced collapse; unsent drafts copy.  
**Honest residual:** live redeploy verify; owner real-sandbox Assist messages; board pixel-atlas; capacity 200×800k NOT MET; release gates OPEN; pilot/production-ready not claimed; HMRC Recognised not claimed.
