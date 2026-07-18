# Sales website — in-depth step-by-step improvement plan

**Date:** 2026-07-18  
**Status:** **Implemented in app v1.26.0** (code + unit tests). Before visual pack remains the baseline; after re-score optional.  
**Evidence base:** [REPORT.md](./REPORT.md) + 140 PNGs in [screenshots/](./screenshots/)  
**Captured against (baseline):** local app ~1.25.x (`http://127.0.0.1:3456`)  
**Related product bar:** [COMPLETION-PLAN.md](../../COMPLETION-PLAN.md) §1.1 / §4 (SALE-01…13)  
**Truth protocol:** [AGENT-TRUTH-PROTOCOL.md](../../AGENT-TRUTH-PROTOCOL.md) — this plan improves **sales UX conversion**; it does **not** claim pilot-ready, production-ready, HMRC Recognised, or capacity.

---

## 0. Why this plan exists

The sales site is **customer-language and usable**, but the 2026-07-18 visual review showed it still behaves like **a set of similar templates**, not one conversion system.

| Lens | Score | Plan target after this wave |
|------|:-----:|-----------------------------|
| Visual consistency | 3.5 | **≥ 4.5** |
| Sales psychology | 3.5 | **≥ 4.0** (without fake proof) |
| Readability desktop | 4.0 | **≥ 4.5** |
| Readability mobile | 3.0 | **≥ 4.0** |
| Conversion clarity | 4.0 | **≥ 4.5** |

**Bottom line from report:** biggest issues are inconsistent navigation, split primary CTA wording, auth pages leaking product chrome, and mobile header wrap.

This document is the **full step-by-step execution plan**. Implement in phase order. Do not skip acceptance gates.

---

## 1. Honesty constraints (non-negotiable)

1. **No fake metrics** — no “used by 10,000 customers”, logos you don’t have, or invented testimonials.  
2. **No HMRC Recognised claims** until listing is real (`docs/DONE-VS-NOT.md`).  
3. **Paid plans honesty** stays — free primary path; paid deferred; no “Buy now” that 503s without Stripe.  
4. **Mode labels stay honest inside the product** — preview / sandbox / live — but **must not appear on cold sales/auth entry**.  
5. **Evidence tags** on any status claim: `ROUTE_ONLY` · `UNIT_TESTED` · `CUSTOMER_WORKFLOW` (screenshots).  
6. Finishing this plan ≠ Sales complete (S1–S7) unless every COMPLETION-PLAN sales exit criterion is also met and evidenced.  
7. Finishing this plan ≠ pilot/production ready. Capacity and release gates remain open.

---

## 2. Scope

### In scope (this wave)

All **public sales + public auth entry** routes captured in the review:

| # | Route | Role |
|---|-------|------|
| 1 | `/` (and `/sales`) | Hub conversion |
| 2 | `/self-employed` | Audience |
| 3 | `/landlords` | Audience |
| 4 | `/professionals` | Audience |
| 5 | `/firms` | Audience / firm |
| 6 | `/how-it-works` | Assist |
| 7 | `/pricing` | Objection handling |
| 8 | `/templates` | Lead magnet |
| 9 | `/security` | Trust |
| 10 | `/help` | Support |
| 11 | `/license` | Licensing |
| 12 | `/legal` | Legal hub |
| 13 | `/privacy` | Legal |
| 14 | `/terms` | Legal |
| 15 | `/signin` | Return users |
| 16 | `/register` | Primary conversion |
| 17 | `/forgot-password` | Recovery entry |

**Also in scope:** shared chrome JS/CSS, injection from `src/server.js`, unit tests, post-fix recapture pack, STATUS note with evidence tags.

### Out of scope (do not expand this wave into)

- Product shell UX (`/home`, `/app`, year-end density, practice CRUD) — separate track from 51-screen product audit.  
- Live Stripe, transactional email, HMRC Production, capacity load tests.  
- Paid ads, SEO empire, A/B platform.  
- Inventing social proof numbers.  
- Figma redesign as a substitute for shipping code (optional later sync).

---

## 3. Locked product/sales decisions

Decide once; implement everywhere. Do not re-debate mid-wave.

| Decision | Locked choice | Rationale |
|----------|---------------|-----------|
| **Primary free CTA label** | **Get started free** | Highest frequency in current home; clear benefit; one memory cue |
| **Primary free CTA href** | `/register` | Single funnel destination |
| **Secondary template CTA** | **Download free template** → `/download/template` | Unify “Get free template” variants |
| **Secondary educate CTA** | **How it works** → `/how-it-works` | Consistent wording |
| **Sign-in label** | **Sign in** → `/signin?next=/home` (marketing header) | Return users; next= product home |
| **Register page H1** | May stay “Create account” (page purpose) | Button must still say **Get started free** |
| **Nav set (desktop + mobile)** | Self-employed · Landlords · Accountants · How it works · Pricing · Help · Sign in · Get started free | Matches strongest home nav; firms via professionals/license/footer |
| **Mode pill** | **Product shell paths only** | Never marketing, never public auth entry |
| **Auth theme** | **Light sales surface** (`theme-light` + sales chrome) | Forgot-password must not be dark app shell |
| **Hero honesty** | Keep review-before-send + not recognised | Move “paid plans not available yet” off home hero trust list → **pricing only** |
| **Proof block** | Soft, non-numeric | e.g. “Built for sole traders, landlords, and small practices” — no fake counts |

---

## 4. Target architecture

### 4.1 One sales chrome system

```
Browser loads marketing/auth HTML
        │
        ├─ site-chrome.js   → legal footer line; mode pill ONLY on product shell
        └─ sales-chrome.js  → standard header + footer + hamburger + CTA unify + light theme
```

| File | Responsibility |
|------|----------------|
| `public/js/sales-chrome.js` | Shared nav (`data-sales-nav="v1"`), footer (`data-sales-footer="v1"`), mobile drawer, force light theme on public auth, rewrite legacy CTA labels |
| `public/js/site-chrome.js` | HMRC quiet legal line; `isProductShellPath()` gates mode pill |
| `public/css/site.css` | `.sales-nav-*`, hero lead contrast, eyebrow ≥13px, mobile header |
| `src/server.js` | `sendAppHtml` / marketing inject: always inject `site-chrome.js`; inject `sales-chrome.js` for marketing + public auth HTML set |
| Static `public/*.html` | Semantic content; static headers may remain as progressive enhancement; chrome overwrites to one system |

### 4.2 Product shell path list (mode pill allowed)

Mode pill **only** when path is (or under):

`/home`, `/app`, `/onboarding`, `/records`, `/year-end`, `/workspace`, `/connect-hmrc`, `/account`, `/history`, `/billing`, `/admin`, `/mtd`  
(and practice shells via body class — never pure marketing).

**Never mode pill on:** `/`, `/sales`, audience pages, pricing, help, legal, `/signin`, `/register`, `/forgot-password`, `/reset-password`, `/accept-invite`.

### 4.3 Funnel (unchanged structure, tighter execution)

```
Home ─┬─► Audience pages ─► Get started free (/register)
      ├─► How it works / Templates (assist)
      ├─► Pricing (free vs later — objection handling)
      └─► Sign in (return)
```

---

## 5. Phased execution (step-by-step)

Execute **A → B → C → D → E → F → G**.  
Do not start B content work until A acceptance is green.  
Commit/push after each phase (or A+B together if small) with version notes. Do not stop for “optional next step” on internal work.

---

### Phase A — Shared chrome + CTA + auth leak (P0)

**Goal:** One system of navigation, one primary CTA vocabulary, no product mode chrome on sales/auth, readable dark heroes, light forgot-password.

#### A1 — Shared marketing header + mobile menu

| Step | Action | Detail |
|------|--------|--------|
| A1.1 | Ship `public/js/sales-chrome.js` | `ensureHeader()` builds logo, desktop nav, hamburger, drawer; set `data-sales-nav="v1"` |
| A1.2 | Nav links | Exact locked set in §3; mark `is-active` by path |
| A1.3 | Mobile drawer | Toggle `aria-expanded`, Escape closes, `body.sales-nav-open` for scroll lock if needed |
| A1.4 | Shared footer | Help · Pricing · Security · Privacy · Terms · Legal · Licensing + honesty line; `data-sales-footer="v1"` |
| A1.5 | Inject from server | `MARKETING_HTML` (or equivalent) set includes all 17 routes’ HTML files; inject `<script src="/js/sales-chrome.js" defer>` once per response if missing |
| A1.6 | CSS | `.sales-nav-toggle` visible ≤~900px; hide desktop nav on small screens; drawer full-width readable links; primary CTA not wrapping as broken multi-row header |
| A1.7 | Static HTML cleanup (optional but preferred) | Leave minimal static headers so no-JS still works; or empty header shell — chrome fills either way |

**Acceptance A1**

- [ ] Every marketing + public auth route HTTP 200 includes `sales-chrome.js` in HTML.  
- [ ] After JS runs, `header[data-sales-nav="v1"]` present on those pages.  
- [ ] Mobile 390px: hamburger visible; desktop nav not a multi-row wrap disaster.  
- [ ] Footer links present on pages that previously had only “Home”.

#### A2 — Unify CTA vocabulary site-wide

| Step | Action | Detail |
|------|--------|--------|
| A2.1 | Static rewrite | Grep all `public/*.html` for `Create free account`, `Start free`, `Start now`, `Get free template` — fix primary paths to locked labels |
| A2.2 | Runtime unify | `unifyCtaLabels()` in sales-chrome for residual mismatches (register buttons, legacy) |
| A2.3 | Sign-in link text | “Create account” link to register may become “Get started free” **or** remain short “Create account” if not a `.btn` primary — prefer primary buttons = **Get started free** |
| A2.4 | Register submit | Button text **Get started free**; page title/H1 can stay Create account |
| A2.5 | Secondary | Template CTAs → **Download free template** |

**Acceptance A2**

- [ ] `rg "Create free account" public/` → 0 in primary CTA contexts (or 0 total if feasible).  
- [ ] Home + pricing + audience pages use **Get started free** for primary.  
- [ ] Unit test asserts home has ≥1 “Get started free” and 0 “Create free account”.

#### A3 — Mode pill off auth; light forgot-password

| Step | Action | Detail |
|------|--------|--------|
| A3.1 | `isProductShellPath()` in site-chrome | Explicit allowlist; early return if sales surface or not product path |
| A3.2 | Sign-in / register / forgot HTML | Remove any static “Preview only”, mode pill markup, “Marketing site” confusion if present |
| A3.3 | Force light theme | sales-chrome `forceLightTheme()`: `theme-light`, `sales-surface`; strip `app-body` on auth entry paths |
| A3.4 | Forgot-password CSS | Body must not paint as `rgb(11, 18, 32)` dark shell for signed-out recovery |
| A3.5 | Copy | Sign-in is for returning customers; no product-mode education on cold entry |

**Acceptance A3**

- [ ] GET `/signin` HTML does not contain `st-mode-pill` or “Preview only”.  
- [ ] Visual: forgot-password matches light sales surface (recapture later in G).  
- [ ] Signed-in product `/home` still can show mode pill (regression check).

#### A4 — Hero lead contrast + eyebrow size

| Step | Action | Detail |
|------|--------|--------|
| A4.1 | Hero lead | On dark gradient heroes, lead text lighter (near-white / high-opacity slate-100) or strengthen scrim behind text |
| A4.2 | Eyebrow | `.eyebrow` min **13px** (was ~11.8px) |
| A4.3 | Spot-check | Home, self-employed, landlords, professionals, firms desktop fold |

**Acceptance A4**

- [ ] No washed dark-grey-on-dark-blue lead on fold screenshots.  
- [ ] Eyebrow ≥13px in computed styles / CSS rule.

#### A — Phase exit

- [ ] `tests/sales-chrome.test.js` green (fix brittle asserts if needed — assert behaviour/markers, not accidental string literals).  
- [ ] Full `npm test` green.  
- [ ] Version bump note (e.g. 1.26.x) for chrome system.  
- [ ] Commit + push.

**Files (primary):**  
`public/js/sales-chrome.js`, `public/js/site-chrome.js`, `public/css/site.css`, `src/server.js`, all marketing/auth HTML, `tests/sales-chrome.test.js`, `package.json`.

---

### Phase B — Conversion content (P1)

**Goal:** Stronger home conversion without lying; pricing owns paid-deferred honesty; soft proof; secondary CTA alignment.

#### B1 — Home trust list and desire

| Step | Action |
|------|--------|
| B1.1 | Ensure home hero trust list does **not** include “paid plans not available yet” (pricing only) |
| B1.2 | Keep free path + review-before-send; outcome language: avoid retyping at deadline |
| B1.3 | Hero card note: sample numbers are illustration only (keep) |

#### B2 — Soft proof block (no fake metrics)

| Step | Action |
|------|--------|
| B2.1 | Add one section on home (and optionally how-it-works): e.g. “Built for sole traders, landlords, and small UK practices who already live in spreadsheets.” |
| B2.2 | Optional: three outcome bullets (no counts): keep your file · see plain-English review · approve before send |
| B2.3 | Explicit ban: no logos, no star ratings, no “N customers” without real evidence |

#### B3 — Pricing as objection handler

| Step | Action |
|------|--------|
| B3.1 | Paid deferred honesty lives here: free to start; paid plans not live yet / coming later |
| B3.2 | Primary CTA remains **Get started free** → `/register` |
| B3.3 | No purchase button that implies live Stripe |

#### B4 — Audience page consistency

| Step | Action |
|------|--------|
| B4.1 | Self-employed / landlords / professionals / firms: same section rhythm (problem → steps → CTA → related links) |
| B4.2 | Professionals: keep “practice workspace” for return users **and** short first-time education (what you get before sign-in) |
| B4.3 | Firms: license path clear without fake enterprise pricing |

#### B5 — Secondary CTA vocabulary

| Label | Destination |
|-------|-------------|
| Download free template | `/download/template` or `/templates` |
| How it works | `/how-it-works` |
| See pricing | `/pricing` |
| For accountants | `/professionals` |
| For larger firms / licensing | `/firms` or `/license` |

**Acceptance B**

- [ ] Home trust list free of paid-deferred line; pricing contains it.  
- [ ] Soft proof present; zero fake social proof.  
- [ ] Audience pages share chrome + primary CTA.  
- [ ] `npm test` green; commit + push.

---

### Phase C — Auth entry polish (sales continuity)

**Goal:** Sign-in / register / forgot feel like the **same product brand** as sales, not a different app.

| Step | Action |
|------|--------|
| C1 | Sign-in: clear H1 “Sign in”; subcopy for return users; link **Get started free** to register |
| C2 | Remove leftover “not the marketing website” / mode education if any remains |
| C3 | Register: benefits strip short (3 bullets max); consent stays required |
| C4 | Forgot-password: light theme verified; honest email stub language if applicable (no “check server logs” for customers) |
| C5 | Shared sales header on all three (from Phase A) |

**Acceptance C**

- [ ] Desktop + mobile fold of 15–17 look light and on-brand.  
- [ ] No mode pill in DOM after JS on those pages.  
- [ ] Tests still pass.

---

### Phase D — Mobile readability (P1)

**Goal:** Mobile score ≥ 4.0 — chrome doesn’t eat the first screen.

| Step | Action |
|------|--------|
| D1 | Hamburger only below breakpoint; single-row logo + menu button |
| D2 | Drawer: stacked links, large tap targets (≥44px height), primary CTA at bottom of drawer |
| D3 | Sticky header height reduced on mobile |
| D4 | Hero actions stack cleanly (primary full width, secondary full width) |
| D5 | Spot-check home, pricing, sign-in at 390×844 |

**Acceptance D**

- [ ] Mobile fold screenshots: header is one compact bar, not multi-row link wrap.  
- [ ] Primary CTA visible without scrolling past a wall of nav (or drawer closed by default — preferred).

---

### Phase E — Legal / trust density (P2 polish)

**Goal:** Security/privacy/terms remain accurate documents; sales doesn’t bury the user in legal on the hub.

| Step | Action |
|------|--------|
| E1 | Security: customer-readable sections; keep technical accuracy; link from footer |
| E2 | Privacy / terms: document layout OK; shared sales chrome; no aggressive register spam mid-legal |
| E3 | Legal hub `/legal`: clear index to privacy, terms, license, security |
| E4 | Home: do **not** dump full legal density; link out |

**Acceptance E**

- [ ] Legal pages use shared chrome.  
- [ ] Home length not dominated by legal prose.

---

### Phase F — Instrumentation + completion-plan alignment (P1 optional this wave)

Only if Phase A–E are solid.

| Step | Action | Maps to |
|------|--------|---------|
| F1 | Log or analytics hook on primary CTA clicks (even server log or client `data-cta` events) | SALE-12 / S5 |
| F2 | Optional real app review screenshot on how-it-works (honest UI capture, not mock marketing CGI) | SALE-13 |
| F3 | Moderated 10-second target protocol documented once strategy interviews start | S7 — **external** if not done |

**Honesty:** F1 without real analytics backend can be `data-cta="get-started-free"` + test that attributes exist (`ROUTE_ONLY`).

---

### Phase G — Verify, recapture, status, ship

| Step | Action |
|------|--------|
| G1 | Fix any failing unit tests (prefer behavioural asserts: inject markers, path gating — not fragile source greps for strings that refactor removed) |
| G2 | `npm test` full suite green |
| G3 | `npm run test:e2e` if visual e2e exists / update snapshots if intentional |
| G4 | Recapture sales pack: all 17 routes × desktop + mobile fold + full (+ scroll stages if page tall) into new dated folder **or** overwrite with note in REPORT |
| G5 | Write **after** scores in `REPORT.md` appendix or `AFTER-REPORT.md` |
| G6 | Update `docs/STATUS.md`: blockers first; list chrome work as `UNIT_TESTED` / screenshot `CUSTOMER_WORKFLOW`; **do not** claim pilot-ready |
| G7 | Version tag in package.json if not already; commit; **push main** (standing project rule) |
| G8 | Record any overclaim slip in `docs/TRUTH-AUDIT.md` if it happened during the wave |

**Acceptance G**

- [ ] Before/after evidence exists on disk.  
- [ ] STATUS matches evidence.  
- [ ] Remote main has the commits.

---

## 6. Page-by-page change matrix

| Page | Phase | Must change | Nice |
|------|-------|-------------|------|
| `/` home | A, B, D | Chrome, CTA, hero contrast, trust list, soft proof | Outcome copy polish |
| `/self-employed` | A, B | Full nav, CTA, contrast | Steps copy |
| `/landlords` | A, B | Same | Same |
| `/professionals` | A, B | Full nav; first-time + return paths | Soft proof |
| `/firms` | A, B | Full nav; license clarity | — |
| `/how-it-works` | A, B, F | Chrome; optional app screenshot | — |
| `/pricing` | A, B | Chrome; paid-deferred honesty home | Package clarity |
| `/templates` | A, B | Chrome; Download free template | — |
| `/security` | A, E | Chrome; readable sections | — |
| `/help` | A | Full nav (was sparse) | Task cards |
| `/license` | A, B | Chrome | — |
| `/legal` | A, E | Chrome (was “Home” only) | Index clarity |
| `/privacy` | A, E | Chrome | — |
| `/terms` | A, E | Chrome | — |
| `/signin` | A, C, D | No mode pill; light; brand header | Copy |
| `/register` | A, C | Get started free button; chrome | Benefits strip |
| `/forgot-password` | A, C | Light theme; chrome | Copy |

---

## 7. Implementation checklist (file-level)

Use as a working checklist during execution.

### Code / assets

- [ ] `public/js/sales-chrome.js` — header, footer, drawer, theme, CTA unify  
- [ ] `public/js/site-chrome.js` — product-path-only mode pill  
- [ ] `public/css/site.css` — sales nav, hero lead, eyebrow, mobile  
- [ ] `src/server.js` — inject sales-chrome on marketing + auth HTML  
- [ ] `public/sales.html` (+ route alias `/`)  
- [ ] `public/self-employed.html`  
- [ ] `public/landlords.html`  
- [ ] `public/professionals.html`  
- [ ] `public/firms.html`  
- [ ] `public/how-it-works.html`  
- [ ] `public/pricing.html`  
- [ ] `public/templates.html`  
- [ ] `public/security.html`  
- [ ] `public/help.html`  
- [ ] `public/license.html`  
- [ ] `public/legal.html`  
- [ ] `public/privacy.html`  
- [ ] `public/terms.html`  
- [ ] `public/signin.html`  
- [ ] `public/register.html`  
- [ ] `public/forgot-password.html`  
- [ ] `tests/sales-chrome.test.js`  
- [ ] `package.json` version  

### Docs / evidence

- [ ] This plan executed / status updated  
- [ ] After recapture pack  
- [ ] `docs/STATUS.md` evidence-tagged  
- [ ] Link from audit README  

---

## 8. Test plan (must stay green)

### Unit / integration (`npm test`)

| Test area | Asserts |
|-----------|---------|
| Injection | Marketing + auth routes include `sales-chrome.js` |
| Markers | Source has `data-sales-nav`, hamburger, **Get started free** |
| Mode gate | `isProductShellPath` exists; pill not injected logic on sales; **do not** require literal `/signin` in source unless used |
| CTA | Home static HTML: Get started free present; Create free account absent |
| Sign-in | Response body lacks `st-mode-pill` / “Preview only” |
| Regression | Security freeze, auth gates, product surfaces still pass |

### Visual / manual

| Check | Viewport |
|-------|----------|
| Home fold: contrast + single primary CTA | 1440, 390 |
| Audience page: full nav parity | 1440 |
| Mobile: hamburger, no wrap chaos | 390 |
| Sign-in: no amber mode pill | 1440, 390 |
| Forgot-password: light background | 1440, 390 |
| Pricing: paid deferred honesty | 1440 |

### Recapture command pattern

```bash
# App listening on :3456 (correct Spreadsheet Tax process)
# Re-run the Playwright sales capture used for this audit pack
# Output: docs/audits/2026-07-18-sales-site-review/screenshots/  OR new dated folder
```

---

## 9. Definition of done — this wave only

Call this wave **done** only when **all** are true:

1. Phases **A–E** acceptance boxes checked with evidence.  
2. `npm test` green on the branch that will ship.  
3. After screenshots exist for at least fold desktop+mobile on all 17 routes (full pack preferred).  
4. Primary CTA label is **Get started free** across sales primaries.  
5. Shared nav marker present on sales surfaces.  
6. Mode pill absent on public auth entry (verified by test + screenshot).  
7. Forgot-password light theme verified.  
8. STATUS updated without pilot/production/recognised overclaims.  
9. Commits pushed to `origin/main` (or agreed release branch).

**Not required for this wave done:** S7 moderated interviews, live analytics SaaS, capacity, HMRC recognition, Stripe.

---

## 10. Mapping to COMPLETION-PLAN sales items

| SALE / S | Plan phase | Notes |
|----------|------------|-------|
| SALE-01 hub | A, B | Conversion redesign chrome + content |
| SALE-02…05 audiences | A, B | Nav + CTA + education |
| SALE-06 pricing | A, B | Honesty placement |
| SALE-07 how-it-works | A, B, F | Optional screenshot |
| SALE-08 templates | A, B | CTA unify |
| SALE-09 security | A, E | Trust accuracy |
| SALE-10 help | A | Nav parity |
| SALE-11 shared header/footer + mobile | **A (core)** | |
| SALE-12 analytics | F | Optional this wave |
| SALE-13 walkthrough shot | F | Optional |
| S1–S4 structure | Mostly met pre-wave; tighten | |
| S5 instrumentation | F | |
| S6 claims match behaviour | Continuous | Grep + honesty review |
| S7 moderated targets | External / strategy | |

---

## 11. Current WIP snapshot (as of plan authoring)

Work already started mid-wave (not yet fully shipped as a clean green release):

| Item | State |
|------|--------|
| `public/js/sales-chrome.js` | Present (uncommitted / WIP) — header, footer, drawer, CTA unify, light theme |
| `public/js/site-chrome.js` | WIP — `isProductShellPath` mode gate |
| `src/server.js` | WIP — inject sales-chrome for marketing HTML |
| CTA static rewrites | Partially applied (“Get started free” widespread) |
| `package.json` | Version may already show **1.26.0** while STATUS still 1.25.0 — reconcile on ship |
| `tests/sales-chrome.test.js` | Present; **may fail** if it asserts `/signin` literal in site-chrome source — fix assert to match design |
| Commit/push of chrome wave | **Not complete** until tests green + push |

**First execution action when resuming:** fix sales-chrome test → finish A acceptance → `npm test` → commit/push Phase A → continue B.

---

## 12. Execution rules for agents

1. **Blockers first** in any status update.  
2. **One code writer** at a time on overlapping files.  
3. **Do not shrink** owner complete bars in COMPLETION-PLAN; this wave is a **subset** that raises sales quality.  
4. **Autonomous commit/push** for this project’s internal sales work after green tests (standing owner rule).  
5. **Human gates remain human:** pen-test, tax sign-off, HMRC Production, SDSTeam email, recognised flag flip, production deploy approval.  
6. Prefer **behavioural tests** over brittle source greps.  
7. After material UI change: unit tests; if e2e visual exists, update intentionally.  
8. Recapture is part of done — not optional decoration.

---

## 13. Suggested commit sequence

| Commit | Contents |
|--------|----------|
| 1 | Phase A: sales-chrome system + mode gate + CTA + hero CSS + tests (v1.26.x) |
| 2 | Phase B: home proof/trust/pricing honesty placement + audience polish |
| 3 | Phase C–D: auth copy + mobile nav polish |
| 4 | Phase E–F: legal chrome + optional instrumentation |
| 5 | Phase G: recapture artifacts + STATUS + after scores |

Smaller atomic commits are fine if tests stay green.

---

## 14. Risk register

| Risk | Mitigation |
|------|------------|
| Double headers (static + JS) flash | Chrome replaces header innerHTML; keep structure identical; optional hide until ready |
| No-JS users lose full nav | Keep static header with core links before JS runs |
| Mode pill regresses onto sign-in | Unit test on HTML + path gate |
| Overclaim “sales complete” | Only mark SALE items when checklist evidence exists; STATUS blockers first |
| Mobile drawer a11y | `aria-expanded`, Escape, focus not trapped poorly |
| Inject misses a route | MARKETING set must list every HTML file; test loops all 17 |

---

## 15. After-wave scorecard (Phase G)

| Lens | Before | After (code review) | Evidence |
|------|:------:|:-------------------:|----------|
| Visual consistency | 3.5 | **~4.5 expected** | One `sales-chrome` nav/footer on all marketing+auth [UNIT_TESTED inject] |
| Sales psychology | 3.5 | **~4.0 expected** | Soft proof; pricing owns paid-deferred; one CTA [UNIT_TESTED] |
| Readability desktop | 4.0 | **~4.5 expected** | Hero lead #e8eef7 + eyebrow 13px [CSS ROUTE_ONLY] |
| Readability mobile | 3.0 | **~4.0 expected** | Hamburger + sticky header CSS [ROUTE_ONLY] |
| Conversion clarity | 4.0 | **~4.5 expected** | Get started free everywhere; data-cta hooks [UNIT_TESTED] |

**Honest gap:** full after PNG recapture pack not re-scored in this commit. Re-run Playwright fold captures when validating deploy.

---

## 16. Quick reference — priority stack

```
P0  A1 Shared nav + hamburger
P0  A2 One CTA: Get started free
P0  A3 Mode pill off auth; light forgot-password
P0  A4 Hero contrast + eyebrow
P1  B  Home proof / trust list / pricing honesty placement
P1  C  Auth brand continuity
P1  D  Mobile chrome density
P2  E  Legal density discipline
P1* F  Instrumentation / app screenshot (*optional this wave)
—   G  Tests, recapture, STATUS, push
```

---

## 17. Links

| Doc | Role |
|-----|------|
| [REPORT.md](./REPORT.md) | Before scores and findings |
| [README.md](./README.md) | Capture pack index |
| [COMPLETION-PLAN.md](../../COMPLETION-PLAN.md) | Full product + sales complete bar |
| [AGENT-TRUTH-PROTOCOL.md](../../AGENT-TRUTH-PROTOCOL.md) | Anti-overclaim |
| [STATUS.md](../../STATUS.md) | Living evidence-tagged status |
| [PRODUCT-SURFACE-FREEZE.md](../../PRODUCT-SURFACE-FREEZE.md) | What product nav may expose |

---

*End of plan. Execute Phase A first; do not claim the wider product is complete when this sales wave ships.*
