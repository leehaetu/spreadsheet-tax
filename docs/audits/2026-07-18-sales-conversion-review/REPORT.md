# Sales website — full visual conversion audit

**Date:** 2026-07-18  
**Live base:** https://spreadsheet-tax-production.up.railway.app  
**App version captured:** **1.32.0**  
**Method:** Playwright Chromium — **every public sales/auth route** at **desktop 1440×900** and **mobile 390×844**, fold + full page, mobile menu open, plus **funnel click path** captures.  
**Artifacts:** `screenshots/` (**89 PNGs**), `findings.json`  
**Honesty:** This is a visual + conversion audit of the **running production site**, not a mock. High conversion is **not** claimed as achieved.

---

## 1. Capture inventory

| Item | Count |
|------|------:|
| Routes | 17 (`/` through `/forgot-password`) |
| Viewports | 2 (desktop, mobile) |
| Page captures | **34** (route × viewport) |
| Extra | mobile menu opens, 4 funnel-step screenshots |
| Total PNGs | **89** |
| HTTP non-200 | **0** |

### Routes covered

1. `/` home  
2. `/self-employed`  
3. `/landlords`  
4. `/professionals`  
5. `/firms`  
6. `/how-it-works`  
7. `/pricing`  
8. `/templates`  
9. `/security`  
10. `/help`  
11. `/license`  
12. `/legal`  
13. `/privacy`  
14. `/terms`  
15. `/signin`  
16. `/register`  
17. `/forgot-password`  

### Funnel clicks captured

| Shot | Path |
|------|------|
| `funnel-01-home-to-self-employed.png` | Home → Self-employed |
| `funnel-02-self-employed-to-register.png` | Self-employed → Register |
| `funnel-03-pricing-to-register.png` | Pricing → Register |
| `funnel-04-template-download-nav.png` | Templates → template download |

---

## 2. Overall scores (1–5)

| Lens | Score | Notes |
|------|:-----:|-------|
| Visual consistency | **4.0** | Shared chrome, logo, blue CTAs; hero still fights trust-list contrast |
| Readability desktop | **3.5** | Body/cards good; **hero trust bullets still wash out** on live fold |
| Readability mobile | **4.0** | Type stacks well; hamburger works |
| Usability / interaction | **4.0** | Primary paths work; mobile nav drawer opens |
| Visual quality / polish | **3.5** | Clean modern UI, but product screenshot is noisy (cookie bar, dual pills) |
| Conversion psychology | **3.5** | Clear free CTA; weak social proof; pricing honesty may suppress desire |
| Conversion readiness | **3.5** | Funnel is simple; not “very high %” without proof fixes below |

**Bottom line:** The site is **usable and coherent**, not broken. It is **not** yet a high-conversion sales system. Biggest conversion killers are **washed hero trust copy**, **noisy product screenshot**, **ghost secondary CTA**, **no social proof**, and **experimental pricing next to Free** without stronger free-path dominance.

---

## 3. Automated findings (metrics)

| Sev | Count | Detail |
|-----|------:|--------|
| P0 auto | **0** | No mode pill, no broken images, no failed nav |
| P1 auto | **3** | Mobile header “Get started free” height ~39px (&lt; 44px target) on signin/register/forgot |

**Important:** Auto contrast heuristic did **not** flag trust list on this run (computed colour may pass threshold while **perceived** contrast on the gradient still fails). **Human visual review overrides auto** for that item → treated as **P0**.

---

## 4. Human visual evaluation (from screenshots)

### 4.1 Home `/` — desktop fold (`01-home-desktop-fold.png`)

| Aspect | Assessment |
|--------|------------|
| Nav | Clean, white bar, clear Sign in + Get started free |
| H1 | Strong white on dark gradient — good |
| Lead | Readable white/off-white — good |
| Primary CTA | Strong blue “Get started free” — good |
| Secondary CTA | **Ghost button nearly invisible** on dark hero (“Download free template”) — **P0 conversion** |
| Trust list | **Checks + text still wash out / very low contrast** on gradient — **P0 readability** |
| How it works card | High contrast white card, good CTA — good |
| Overall | Premium layout, but **two fail points above fold** |

### 4.2 Home `/` — desktop full (`01-home-desktop-full.png`)

| Aspect | Assessment |
|--------|------------|
| Who it’s for | 4 clear cards — good segmentation |
| Product preview | Real app UI helps credibility — **but** includes **cookie banner** + **two mode pills** + dense internal chrome — looks unfinished — **P0 quality** |
| Benefits / UK books | Clear cards — good |
| FAQ | Present — good |
| Final CTA | Clear — good |
| Footer | Honest HMRC / licensing — good for trust, correct honesty |

### 4.3 Home `/` — mobile fold + menu

| Aspect | Assessment |
|--------|------------|
| Stack | CTAs full width — good |
| Trust list | Better than desktop (still check post–1.31.1 deploy) |
| Menu open | Drawer shows all key links + Get started free — usable |
| Fold | “Who it’s for” below fold — acceptable if CTA is strong above fold |

### 4.4 Pricing `/pricing` — desktop

| Aspect | Assessment |
|--------|------------|
| 5 packages | Present; Free is clearly “Available now” |
| Experimental labels | Honest — good for compliance |
| Conversion risk | Four “not for sale” cards may **distract** and reduce urgency — **P1 psychology** |
| Density | Five columns tight but legible at 1440 |
| Footer honesty | Strong “Paid plans not available yet” — correct |

### 4.5 How it works

| Aspect | Assessment |
|--------|------------|
| 4 steps | Clear |
| Review image | Same cookie/mode-pill problems as home |
| FAQ | Present |
| CTAs | Get started free + template — good |

### 4.6 Register `/register`

| Aspect | Assessment |
|--------|------------|
| Layout | Clean, light, focused |
| Benefits strip | Three ticks — good |
| Form | Name/email/password/consent — standard |
| Primary button | Get started free — good |
| Double CTA | Header also “Get started free” while on register — slight redundancy, not fatal |

### 4.7 Sign-in / forgot / legal / security

| Page | Assessment |
|------|------------|
| Sign-in | Clean (MFA should stay hidden until required — fixed in 1.31.1 code; re-verify live) |
| Security | Readable panels, honest recognition |
| Legal hub | Sparse but adequate as index |
| Privacy/terms | Document density OK for legal |

### 4.8 Funnel clicks

| Step | Result |
|------|--------|
| Home → SE | Works |
| SE → Register | Works |
| Pricing → Register | Works |
| Template download | Navigates (download behaviour browser-dependent) |

---

## 5. Conversion psychology audit

| Principle | Score | Comment |
|-----------|:-----:|---------|
| Clarity of offer | 4.5 | Immediately clear |
| Audience fit | 4.0 | Four paths present |
| Trust / risk | 4.0 | Honesty is strong; screenshot quality undercuts polish |
| Social proof | **1.5** | No real testimonials, logos, or “used by” (correctly no fake numbers) |
| Urgency | 1.5 | No MTD deadline framing |
| Friction to start | 4.5 | Free, no card |
| Message consistency | 4.0 | CTA vocabulary mostly unified |
| Visual system | 3.5 | Two CTA styles on dark hero; noisy product shot |

**High-conversion bar (very high %):** not met. Structure is enough for a competent free SaaS funnel; **not** enough for top-quartile conversion without the plan below.

---

## 6. What “finished + high conversion” requires

COMPLETION-PLAN S1–S7 structure is largely in place. **High conversion** needs additional work:

1. **Fix all above-fold visual fails** (trust list, ghost CTA, product shot).  
2. **One clean product visual** (no cookie, single mode label, marketing crop).  
3. **Conversion hierarchy:** Free path dominates; experimental pricing demoted or on secondary screen.  
4. **Proof without lies:** soft outcomes, deadline framing, optional real quotes when Lee has them.  
5. **Measure:** CTA events → register complete rate on live.  
6. **Re-capture** after fixes; scores must rise on screenshots, not claims.

---

## 7. Severity backlog (from this audit)

### P0 — fix before any “high conversion” claim

1. **Hero trust list contrast** — force readable white/near-white on all breakpoints (verify live after deploy).  
2. **Hero secondary CTA** — solid outline or solid light button, not washed ghost.  
3. **Replace product review image** — recapture app without cookie banner; hide dual mode pills in marketing crop; optional chrome crop to review panel only.  
4. **Confirm 1.31.1+ sign-in MFA hidden** on production after deploy.

### P1 — conversion uplift

5. Pricing layout: Free full-width featured row; experimental packs in collapsed “Future packages” or 2+3 grid.  
6. Mobile header primary CTA min-height **44px**.  
7. Deadline strip: “Next MTD deadline” with link to help (no fake urgency).  
8. Soft proof block without fake metrics (already partial — strengthen).  
9. Reduce “Create free account” language in how-it-works card step 1 to match “Get started free”.  
10. Register: remove duplicate header primary or change header to “Sign in” only on register page.

### P2 — polish

11. Active nav state stronger colour.  
12. Product preview max-width / shadow consistency.  
13. Legal pages denser chrome (sales-chrome already injects).  
14. A11y: focus rings, skip link.  
15. Optional: video or animated 15s walkthrough later.

---

## 8. Page-by-page summary table

| Page | Usable? | Visible quality | Conversion notes |
|------|:-------:|:---------------:|------------------|
| Home | Yes | Medium (trust list fail) | Strong offer; fix contrast + secondary CTA |
| Self-employed | Yes | Good | Full story + FAQ |
| Landlords | Yes | Good | Full story + FAQ |
| Professionals | Yes | Good | Practice honesty OK |
| Firms | Yes | Good | Capacity honesty OK |
| How it works | Yes | Medium (image noise) | Fix product shot |
| Pricing | Yes | Good | Dominate Free path |
| Templates | Yes | Good | Solid lead magnet |
| Security | Yes | Good | Trust page |
| Help | Yes | OK | Sparse but usable |
| License | Yes | OK | |
| Legal / privacy / terms | Yes | OK for legal | |
| Sign-in | Yes | Good | Verify MFA hide |
| Register | Yes | Good | Main conversion form |
| Forgot password | Yes | Good | |

---

## 9. Evidence paths

```text
docs/audits/2026-07-18-sales-conversion-review/
  REPORT.md                 ← this file
  IMPROVEMENT-PLAN.md       ← phased fix plan
  findings.json             ← automated metrics
  screenshots/              ← 89 PNGs
```

Re-run:

```bash
# same capture script used this session, or:
BASE_URL=https://spreadsheet-tax-production.up.railway.app \
  node scripts/audit-sales-live.mjs
```

---

## 10. Honesty

- **Sales structure (S1–S7)** can be “complete” as a product path.  
- **High-conversion sales site** is **not** complete until P0 visual fails are fixed, product shot is clean, and conversion metrics are measured.  
- No fake testimonials or “HMRC Recognised” to force conversion.
