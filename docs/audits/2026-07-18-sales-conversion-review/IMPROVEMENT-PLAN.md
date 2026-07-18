# Sales website — plan to finish for **high conversion**

**Date:** 2026-07-18  
**Based on:** [REPORT.md](./REPORT.md) + 89 live screenshots  
**Goal:** Fix every visual/usability fail from the audit, then optimise hierarchy and proof until the free funnel is elite — without lying about HMRC, checkout, or capacity.

**Versioning:** Ship as **minor** when starting this conversion stream (e.g. `1.33.0`); **patch** for follow-ups (`1.33.1`…).

---

## Definition of done — “high conversion sales site”

Call **done** only when **all** are true:

| # | Criterion | Evidence |
|---|-----------|----------|
| C1 | All P0 items in REPORT §7 fixed | Before/after fold screenshots |
| C2 | Product marketing image clean (no cookie, no dual mode pills) | New PNG on home + how-it-works |
| C3 | Free path dominates pricing | Fold screenshot: Free is hero; experimental secondary |
| C4 | Mobile primary CTAs ≥ 44px height | Metrics re-run |
| C5 | Full recapture pack: 17 routes × 2 viewports, 0 P0 | New audit folder |
| C6 | Live `/health` version matches ship | curl |
| C7 | CTA → register funnel still works | Funnel screenshots |
| C8 | No fake proof / no Recognised claim | Grep + visual |

**Not required for this done bar:** real customer testimonials, live Stripe, capacity MET, pilot-ready product.

**Target conversion behaviour (measure after C1–C8):**

- Primary KPI: **Register complete / sales visit** (analytics or server register count)  
- Secondary: template download clicks, pricing → register, audience → register  

Without baseline analytics warehouse, ship **CTA event logging** (already partially present) + weekly export of `/api` analytics if stored.

---

## Phase 0 — Stop the bleed (P0 visuals) · 0.5–1 day

| ID | Task | Files / action | Acceptance |
|----|------|----------------|------------|
| 0.1 | Hero trust list: pure white/near-white text + strong green checks; override any muted theme | `public/css/site.css` | Desktop fold: all 4 bullets clearly readable |
| 0.2 | Hero secondary CTA: high-contrast outline (white border + white text) or solid light button | `site.css` + hero markup if needed | “Download free template” clearly visible on dark hero |
| 0.3 | Recapture product review image | Sign in demo, dismiss cookie, ensure single mode label, crop to review panel, export 1440-wide PNG | No cookie bar; ≤1 mode pill; no double “Preview” chips |
| 0.4 | Replace `public/images/app-review-fold.png` + alt text | home + how-it-works | Both pages show new asset |
| 0.5 | Verify MFA row hidden on live sign-in | Deploy + screenshot | Only email/password until MFA required |
| 0.6 | Deploy + recapture home fold desktop/mobile | Railway + Playwright | Report screenshots updated |

**Exit 0:** C1, C2, C6 for P0 items.

---

## Phase 1 — Conversion hierarchy · 1 day

| ID | Task | Acceptance |
|----|------|------------|
| 1.1 | Pricing: Free as full-width featured band; experimental packages under accordion or “Coming later” section | Fold prioritises Free |
| 1.2 | Home how-it-works card step 1: “Get started free” language, not “Create free account” | Copy match |
| 1.3 | Register page: header CTA = Sign in only (not second Get started free) | Screenshot |
| 1.4 | Soft deadline strip on home + pricing: “MTD quarterly deadlines apply — start free before your next period” (no fake date unless real) | Visible, honest |
| 1.5 | Soft proof (no fake metrics): 3 outcome lines already present — move higher, above long FAQ | Order on full page |
| 1.6 | Mobile: `.btn-primary` min-height 44px site-wide on sales surfaces | Metrics re-run 0 short targets |

**Exit 1:** C3, C4.

---

## Phase 2 — Page depth for conversion · 1–2 days

| ID | Page | Task |
|----|------|------|
| 2.1 | Home | One primary scroll story: Hero → Who → Preview → Why → FAQ → CTA (remove duplicate “Built for real UK books” if it repeats Why) |
| 2.2 | Audience ×4 | Ensure each has social-proof-free outcome + one comparison (“vs retyping / vs full ledger”) |
| 2.3 | Templates | Add “Why download first” + preview of template structure (text, not fake UI) |
| 2.4 | Help | Link every FAQ card to register or template |
| 2.5 | Security | One CTA at bottom: Get started free |
| 2.6 | Sign-in / Register | Shared light chrome; password show/hide optional polish |

**Exit 2:** Content density supports decision without looking sparse or spammy.

---

## Phase 3 — Measure + iterate · ongoing

| ID | Task | Acceptance |
|----|------|------------|
| 3.1 | Ensure every primary CTA has `data-cta` | Grep / unit test |
| 3.2 | Server log or DB table for CTA events (no tax data) | Query last 7 days |
| 3.3 | Weekly: register count vs unique sales sessions if available | Spreadsheet or admin metric |
| 3.4 | A/B only after baseline week (optional) | Document |

---

## Phase 4 — Final proof pack · 0.5 day

| ID | Task |
|----|------|
| 4.1 | Re-run full capture script → `docs/audits/YYYY-MM-DD-sales-conversion-review-after/` |
| 4.2 | Fill scorecard: each lens ≥ 4.5; conversion psychology ≥ 4.0 without fake proof |
| 4.3 | Update STATUS: “Sales high-conversion visual bar” with evidence tags — **not** pilot-ready |
| 4.4 | Version bump + deploy; curl live version |

**Exit 4:** C5, C7, C8 + scorecard.

---

## Execution order (strict)

```
0.1 → 0.2 → 0.3 → 0.4 → 0.5 → 0.6
        ↓
      1.1 → 1.6
        ↓
      2.x as needed
        ↓
      3.1–3.2
        ↓
      4.1–4.4
```

Do **not** start Phase 2 content expansion while Phase 0 screenshot fails remain.

---

## Effort estimate

| Phase | Effort |
|-------|--------|
| 0 | 0.5–1 day |
| 1 | 1 day |
| 2 | 1–2 days |
| 3 | 0.5 day setup + ongoing |
| 4 | 0.5 day |
| **Total to high-conversion bar** | **~4–5 focused days** |

---

## Anti-patterns (forbidden)

- Fake testimonials, fake user counts, fake “HMRC Recognised”  
- Hiding “paid not live” to convert  
- Claiming “very high conversion” without funnel metrics  
- Shipping only docs without re-screenshots  

---

## First command when executing

```bash
# After Phase 0 CSS + image:
npm run version:patch   # or minor if starting stream as 1.33.0
npm test
# deploy, then:
BASE_URL=https://spreadsheet-tax-production.up.railway.app node scripts/audit-sales-live.mjs
# open home desktop fold — trust list must be readable
```

---

## Link to structural complete

Structural S1–S7 may already pass (`docs/SALES-10-SECOND-MODERATED.md`).  
This plan is the **conversion + visual quality bar** on top of structure.
