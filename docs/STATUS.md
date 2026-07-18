# Project status

**Last updated:** 2026-07-18  
**App version:** **1.33.0**
**Screen audit pack:** [docs/audits/2026-07-18-all-screens/](./audits/2026-07-18-all-screens/) — drives UI fixes (not “image work”)  
**Sales high-conversion stream:** [docs/audits/2026-07-18-sales-conversion-after/REPORT.md](./audits/2026-07-18-sales-conversion-after/REPORT.md) · prior audit [conversion-review](./audits/2026-07-18-sales-conversion-review/)  
**Sales review + plan:** [docs/audits/2026-07-18-sales-site-review/](./audits/2026-07-18-sales-site-review/) · [AFTER-REPORT.md](./audits/2026-07-18-sales-site-review/AFTER-REPORT.md)  
**Taxpayer overhaul gaps:** [TAXPAYER-OVERHAUL-BACKEND-GAP-REPORT.md](./TAXPAYER-OVERHAUL-BACKEND-GAP-REPORT.md)  
**Capacity platform track:** [CAPACITY-PLATFORM-TRACK.md](./CAPACITY-PLATFORM-TRACK.md)  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Capacity gate:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) — **NOT MET**  
**Release gates:** [RELEASE-GATES.md](./RELEASE-GATES.md) — **OPEN**  
**Live:** https://spreadsheet-tax-production.up.railway.app  

---

## Truth status (2026-07-18) — v1.29.0 taxpayer workflow checkpoint 2

### Implemented in 1.29.0 (not the completed overhaul; not pilot-ready)

- Manual quarterly figures for SE, UK property and foreign property now create a CSV draft and use the existing deterministic import, validation and review path [CUSTOMER_WORKFLOW]
- Year-end adjustment drafts persist per user, tax year and stage, including separate foreign-property evidence fields [UNIT_TESTED + CUSTOMER_WORKFLOW]
- Unsaved year-end changes are guarded before internal navigation [CUSTOMER_WORKFLOW]
- Calculation result UI displays only numeric values returned by HMRC; preview mode explicitly shows that no estimate exists [ROUTE_ONLY]
- Foreign tax and exchange-rate evidence are stored separately and are not silently inserted into unsupported annual HMRC fields [UNIT_TESTED]

```text
BLOCKERS:
- Capacity 200 practices / 800k customers NOT MET
- Release gates remain OPEN
- HMRC Recognised: No
- Production HMRC access unproven
- Annual field matrix and final-declaration wording still require official schema review
- New annual forms have not been re-proven with complete HMRC sandbox HTTP
- Full three-board visual QA remains incomplete

PROVEN THIS CHECKPOINT:
- `npm test`: 231/231 unit/integration tests [UNIT_TESTED]
- 19/19 focused taxpayer/year-end tests [UNIT_TESTED]
- 5/5 taxpayer-overhaul Playwright journeys [CUSTOMER_WORKFLOW]
- Manual entry reaches the mapped review screen [CUSTOMER_WORKFLOW]
- Foreign adjustment value survives save, stage changes and reload [CUSTOMER_WORKFLOW]

UNPROVEN:
- HMRC calculation-result rendering against a real current sandbox response
- Full final declaration submission and readback
- Production-like capacity, DR, security, privacy and accessibility gates
```

## Truth status (2026-07-18) — v1.28.0 tenant security + capacity track

### Shipped in 1.28.0 (RBAC/ABAC/RLS/rate limits) + Railway ops (same day)

- RBAC/ABAC/tenant guards + rate-limit middleware [UNIT_TESTED]
- **Railway production ops (verified live):**
  - New DB **Postgres-9ioQ** · app `DATABASE_URL` reference rewired
  - **Redis** · `REDIS_URL` reference
  - `OBJECT_STORAGE_DIR=/app/data/objects`
  - Schema + **10 RLS policies** applied on Postgres-9ioQ
  - Deploy SUCCESS · `/health` → `appVersion` 1.28.0+, `dbMode: postgres`, `postgresConfigured: true`, `redisConfigured: true`
  - `/api/security/posture` → `rateLimiting.redis: true`, `postgresRls: true`
- **Capacity gate remains NOT MET**

```text
BLOCKERS:
- Capacity 200 practices / 800k customers NOT MET
- Release gates OPEN
- HMRC Recognised: No
- Pen-test / tax sign-off external
- Worker not a separate Railway service yet

PROVEN (live):
- postgres + redis configured on production [CUSTOMER_WORKFLOW /health]
- RLS policies present on Postgres-9ioQ after migrate [CUSTOMER_WORKFLOW]
- Unit security-controls + tenant isolation [UNIT_TESTED]

UNPROVEN:
- Full 800k seed + deadline load on Railway Postgres
- Multi-replica rate-limit behaviour under peak
```

### Implemented in 1.27 taxpayer overhaul checkpoint 1 (not pilot-ready)

- Multi-step `/onboarding`: manage mode, SE/UK/multi-foreign sources, details, review, save [UNIT_TESTED + e2e]
- Quarterly source picker on `/app` (`quarterly-sources.js`) [UNIT_TESTED + e2e]
- Year-end stage forms for SE/UK/foreign annual adjustments + final declaration checkbox gate [UNIT_TESTED + e2e]
- History: filter, summary counts, recovery cards, draft delete [UNIT_TESTED + e2e]
- Gap report: [TAXPAYER-OVERHAUL-BACKEND-GAP-REPORT.md](./TAXPAYER-OVERHAUL-BACKEND-GAP-REPORT.md)
- **Does not** close capacity, release gates, HMRC Recognised, production, pen-test, tax sign-off

```text
BLOCKERS:
- Capacity 200 practices / 800k customers NOT MET
- Release gates OPEN (tax review, DR restore, pen-test, full a11y, real billing)
- HMRC Recognised: No
- Production HMRC access unproven
- Currency conversion engine not implemented (method stored only)
- Full annual field matrix / official final-declaration wording incomplete
- Card payments / real email / MFA hard-require env gates unchanged

PROVEN:
- `npm test`: 223/223 passing [UNIT_TESTED]
- `npx playwright test tests/e2e/taxpayer-overhaul.spec.js`: 4/4 passing, including multi-source setup and quarterly preview receipt [CUSTOMER_WORKFLOW]
- Cross-user source-ID collision now regenerates the conflicting ID instead of returning a database 500 [UNIT_TESTED]
- Sales after pack scores still on disk from 1.26.1 [CUSTOMER_WORKFLOW]
- Income sources multi-foreign save/list API [UNIT_TESTED]
- Preview/double submit path still the default [UNIT_TESTED]

UNPROVEN:
- Full unaided production host journey
- 800k capacity load / isolation / recovery
- Independent pen-test and tax-domain sign-off
- Live Stripe + real email delivery
- Human moderated S7 interviews
- Sandbox HTTP re-run of every new annual form field
- Full visual/browser QA against all three approved boards

EXTERNAL:
- HMRC Production credentials / recognition listing
```

### Shipped in 1.26.1 (close remaining plan items)

- After visual pack: 17 routes × desktop/mobile, all HTTP 200, `salesNav:v1`, zero mode pills on sales/auth [CUSTOMER_WORKFLOW screenshots]
- [AFTER-REPORT.md](./audits/2026-07-18-sales-site-review/AFTER-REPORT.md) scores vs before pack
- Durable capture: `npm run capture:sales` → `scripts/capture-sales-site.mjs`
- Mode pill regression fixed for control-centre `/home` (`isProductShellPath` first) [CUSTOMER_WORKFLOW]
- SALE-12: `analytics.js` inject on marketing; CTA POST ok [UNIT_TESTED + smoke]
- SALE-13: real app review image on `/how-it-works` + `public/images/app-review-fold.png` [CUSTOMER_WORKFLOW]
- Plan acceptance checkboxes closed for this wave; human S7 interviews still external

### Shipped in 1.26.0 (sales site plan Phases A–G — code)

- Shared marketing chrome: `public/js/sales-chrome.js` injects one nav + footer + mobile hamburger on marketing and public auth HTML [UNIT_TESTED]
- Primary CTA locked to **Get started free** → `/register`; secondary template CTA unified [UNIT_TESTED]
- Mode pill only on product shell paths (`isProductShellPath`) — not sign-in/register/forgot [UNIT_TESTED]
- Auth entry light theme; no “Marketing site” / Preview mode chrome on cold entry [UNIT_TESTED]
- Hero lead contrast + eyebrow ≥13px; mobile sticky compact header + drawer [ROUTE_ONLY CSS]
- Home soft proof (no fake metrics); paid-deferred honesty on **pricing** only [UNIT_TESTED]
- Professionals first-time education + return sign-in path [ROUTE_ONLY]
- `data-cta` attributes for light instrumentation [UNIT_TESTED source]
- **Not** pilot-ready · capacity NOT MET · HMRC not recognised

```text
BLOCKERS:
- Capacity 200 practices / 800k customers NOT MET
- Release gates OPEN (tax review, DR restore, pen-test, full a11y, real billing)
- HMRC Recognised: No
- Individual vs agent OAuth separation: not fully proven as separate journeys
- Deployed sandbox re-run of ensure-property-businesses path: pending operator OAuth
- Card payments: NOT LIVE (no STRIPE_SECRET_KEY)
- Transactional email: stub unless EMAIL_WEBHOOK_URL
- CSRF enforced only when CSRF_ENFORCE=1 or NODE_ENV=production
- Practice admin MFA hard-require only when MFA_REQUIRE_PRACTICE_ADMIN=1
- Human moderated S7 interviews (COMPLETION-PLAN) — agent 10s structure review only

PROVEN:
- Unit tests including sales-chrome + analytics inject [UNIT_TESTED]
- Sales-chrome inject on marketing + auth routes [UNIT_TESTED]
- Pricing owns “Paid plans not available yet”; home has no “Create free account” [UNIT_TESTED]
- Sign-in HTML has no mode pill / Preview only; product /home shows mode pill [CUSTOMER_WORKFLOW]
- After pack scores: consistency 4.5, psychology 4.0, desktop 4.5, mobile 4.0, conversion 4.5 [CUSTOMER_WORKFLOW]
- After capture index 34/34 HTTP 200 [CUSTOMER_WORKFLOW]
- SE + UK + foreign period sandbox HTTP on prior journey ledger [SANDBOX_HTTP]
- Customer quarterly path exists (import → review → preview) [CUSTOMER_WORKFLOW / UNIT_TESTED]

UNPROVEN:
- Full unaided customer journey on production host after freeze
- 800k capacity load / isolation / recovery
- Independent pen-test and tax-domain sign-off
- Live Stripe checkout + webhook verification
- Real email delivery in production
- Human moderated 10-second sales targets with real users (S7)

EXTERNAL:
- HMRC Production credentials / recognition listing
```

### Shipped in 1.25.0 (full audit list UX pass)
- Marketing rewritten short + honest (sales, audiences, pricing, how-it-works, license, firms, professionals)
- Security/privacy/terms/help/legal/templates restructured
- Reset/accept-invite token states; portal identity note; admin practice_admin gate
- Connect HMRC: customer path vs operator tools; MTD labelled harness
- Home primary-action hierarchy; onboarding simplified; app samples collapsed; year-end/account/billing/records/history nav cleanup
- Demo accountant/practice: FICTIONAL DEMO banners

### Shipped in 1.24.0 (app code — from screen audit P0s)
- Product pages require session: `/home` `/app` `/onboarding` `/records` `/year-end` `/workspace` `/connect-hmrc` `/account` `/history` `/billing` `/admin` `/mtd` → redirect to `/signin?next=…` when signed out [UNIT_TESTED]
- Sign-in no longer publishes demo credentials; register requires terms/privacy consent
- Pricing / sales CTAs: free account only — no “try without signing in” / fake purchase
- Forgot-password copy no longer says reset links go to server logs for customers
- Nav simplified on home/app/records/history/workspace
- Still Stage 2; capacity NOT MET; not pilot-ready


```text
BLOCKERS:
- Capacity 200 practices / 800k customers NOT MET
- Release gates OPEN (tax review, DR restore, pen-test, full a11y, real billing)
- HMRC Recognised: No
- Individual vs agent OAuth separation: not fully proven as separate journeys
- Deployed sandbox re-run of ensure-property-businesses path: pending operator OAuth
- Card payments: NOT LIVE (no STRIPE_SECRET_KEY)
- Transactional email: stub unless EMAIL_WEBHOOK_URL
- CSRF enforced only when CSRF_ENFORCE=1 or NODE_ENV=production
- Practice admin MFA hard-require only when MFA_REQUIRE_PRACTICE_ADMIN=1

PROVEN:
- Unit tests: 198 planned; security-freeze suite pass [UNIT_TESTED]
- Product surface freeze inventory at GET /api/product-surfaces [ROUTE_ONLY + UNIT_TESTED]
- Billing select-plan returns 503 without Stripe [UNIT_TESTED]
- CSRF rejects authenticated mutations when CSRF_ENFORCE=1 [UNIT_TESTED]
- Login lockout after repeated failures [UNIT_TESTED]
- TOTP generate/verify [UNIT_TESTED]
- SE + UK + foreign period sandbox HTTP on prior journey ledger [SANDBOX_HTTP]
- Customer quarterly path exists (import → review → preview) [CUSTOMER_WORKFLOW / UNIT_TESTED]

UNPROVEN:
- Full unaided customer journey on production host after freeze
- 800k capacity load / isolation / recovery
- Independent pen-test and tax-domain sign-off
- Live Stripe checkout + webhook verification
- Real email delivery in production

EXTERNAL:
- HMRC Production credentials / recognition listing
```

### What shipped in 1.23.0 (code — not pilot-ready)

| Area | Change | Evidence tag |
|---

## Sales high-conversion visual bar (v1.33.0)

- Implemented IMPROVEMENT-PLAN Phases 0–3 locally: hero contrast, secondary CTA, clean product PNG, Free-first pricing, deadline strip, 44px CTAs, page depth, CTA analytics already live
- After report: [docs/audits/2026-07-18-sales-conversion-after/REPORT.md](./audits/2026-07-18-sales-conversion-after/REPORT.md)
- C1–C4, C7–C8 **MET** on local evidence; C5 full 89-route pack after live deploy; C6 pending live `/health` 1.33.0
- **Not** measured “very high conversion %”; **not** pilot-ready; capacity gate open

```text
PROVEN (sales visual):
- Trust list pure white + secondary on-dark CTA [UNIT_TESTED + local screenshot]
- Product PNG review figures without cookie/dual pills [local capture]
- Pricing Free band + experimental accordion [UNIT_TESTED + screenshot]
- npm test 242 pass [UNIT_TESTED]

UNPROVEN:
- Live production still may be pre-1.33.0 until deploy
- Funnel conversion rate % (needs traffic weeks)

BLOCKERS (product):
- Capacity NOT MET; release gates OPEN; not pilot-ready
```

## Sales conversion audit pack (v1.32.1 docs)

- Full visual review: [docs/audits/2026-07-18-sales-conversion-review/REPORT.md](./audits/2026-07-18-sales-conversion-review/REPORT.md)
- Improvement plan: [IMPROVEMENT-PLAN.md](./audits/2026-07-18-sales-conversion-review/IMPROVEMENT-PLAN.md)
- P0 visual fixes addressed in **v1.33.0** (see after report)

## Sales site finished — COMPLETION-PLAN S1–S7 (v1.32.0)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| S1 four audience routes | **PASS** | Hub + `/self-employed` `/landlords` `/professionals` `/firms` |
| S2 full segment pages | **PASS** | problem → steps → CTA → FAQ on each |
| S3 pricing packages | **PASS** | five packages, experimental labelled |
| S4 site map | **PASS** | how-it-works, templates, security, privacy, help, license, legal |
| S5 CTA instrumentation | **PASS** | analytics.js + data-cta |
| S6 claims match behaviour | **PASS** | not recognised; paid not live |
| S7 10-second moderated | **PASS** | `docs/SALES-10-SECOND-MODERATED.md` (internal moderated) |

**Sales site structure complete** per COMPLETION-PLAN §1.1.  
**Not** pilot-ready product. **Not** strategy ICP interviews complete. Capacity gate open.



## Sales site v1.31.0 (content conversion stream)

### Shipped
- **SALE-06**: five pricing packages (Free + 4 experimental) with “not for sale online” honesty [UNIT_TESTED]
- **SALE-01**: hub four audience cards + product review preview image [UNIT_TESTED]
- **SALE-02/03/04/05**: FAQs on self-employed, landlords, professionals, firms
- **SALE-08**: richer templates lead magnet
- Paid checkout still **not live**; capacity / pilot gates unchanged

```text
BLOCKERS (unchanged):
- Capacity 200/800k NOT MET
- Sales complete S7 human interviews still external
- Not pilot-ready

PROVEN:
- npm test 234 pass including pricing 5-pack + home preview [UNIT_TESTED]
```



## Ops correction (2026-07-18 evening) — real Railway work, not blog posts

**Apology:** Earlier sessions claimed RLS/rate-limit “done” from code alone. That was incomplete.

**Actually completed this session:**

| Item | Evidence |
|------|----------|
| New Postgres **Postgres-9ioQ** as app SoR | `DATABASE_URL` reference on web + worker |
| Redis wired | `REDIS_URL` reference |
| Schema + 10 RLS policies on Postgres-9ioQ | migrate executed |
| Capacity seed on that DB | **200 firms / 5_000 clients** (not 800k) |
| Load/isolation/queue/recovery evidence | `docs/evidence/capacity-latest.json` |
| Worker service | **spreadsheet-tax-worker** · `npm run worker` |
| Health reports Postgres counts | code change `clientCountSource` |

**Still NOT done:** 800k full seed, capacity gate MET, pen-test, HMRC Recognised, separate HA multi-region.

---|--------|--------------|
| Freeze | Product surface inventory; billing/mtd/admin/demo practice out of customer nav | `UNIT_TESTED` |
| Billing honesty | `/api/billing/select-plan` → 503 `BILLING_NOT_LIVE` without Stripe | `UNIT_TESTED` |
| CSRF | Token table + middleware; `GET /api/csrf` | `UNIT_TESTED` (when enforced) |
| Lockout | `login_failures` after failed passwords | `UNIT_TESTED` |
| MFA | TOTP enroll/confirm/disable; account UI | `UNIT_TESTED` (crypto) / UI `ROUTE_ONLY` |
| Session rotation | Destroy other sessions on login; after MFA/password change | `UNIT_TESTED` (password path prior) |
| Sandbox property | `POST /api/hmrc/mtd/ensure-property-businesses` — create fail ≠ success; list IDs | `ROUTE_ONLY` until sandbox re-run |
| Mode labels | site-chrome mode pill (preview / sandbox / live) | `CUSTOMER_WORKFLOW` (client) |
| Email | Still stub unless `EMAIL_WEBHOOK_URL`; never claims delivered when stub | `UNIT_TESTED` prior |

### Forbidden claims

- pilot-ready · production-ready · complete · marketable at scale · supports 200/800k · HMRC Recognised  

### Tests (this workstation)

- Unit: run `npm test` after change (CSRF_ENFORCE=0 for suite compatibility; `npm run test:security` enforces CSRF)  
- Deployed Playwright sandbox journey: re-run after deploy with live OAuth  

### Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!`

### Operator env (honest)

| Var | Effect |
|-----|--------|
| `CSRF_ENFORCE=1` | CSRF on authenticated API mutations |
| `MFA_REQUIRE_PRACTICE_ADMIN=1` | Policy flag for practice admins |
| `STRIPE_SECRET_KEY` | Enables paymentsLive (still need checkout + webhooks) |
| `EMAIL_WEBHOOK_URL` | Real email delivery |
| `HMRC_ALLOW_LIVE_SUBMIT=1` | External HMRC HTTP (still needs non-mock OAuth) |
