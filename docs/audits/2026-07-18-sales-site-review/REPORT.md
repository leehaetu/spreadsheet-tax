# Sales website visual review report

**Date:** 2026-07-18  
**App version captured:** 1.25.x (local `http://127.0.0.1:3456`)  
**Method:** Playwright Chromium full-page + fold + scroll-stage screenshots for every public sales/marketing route at **desktop 1440×900** and **mobile 390×844**.  
**Folder:** `docs/audits/2026-07-18-sales-site-review/screenshots/`  
**Index:** `capture-index.json`  

## Capture inventory

| Metric | Count |
|--------|------:|
| Routes | 17 |
| Viewports | 2 (desktop, mobile) |
| PNG files | **140** |
| Successful HTTP 200 captures | **34/34** page×viewport |

### Routes captured

1. `/` home sales  
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

Each has: `*-full.png`, `*-fold.png`, and `*-scroll-top|mid|bottom.png` where the page is taller than ~1.35× viewport.

---

## Overall verdict

| Lens | Score (1–5) | Summary |
|------|:-----------:|---------|
| Visual consistency | **3.5** | Shared logo, blues, light surfaces; nav and theme drift across pages |
| Sales psychology | **3.5** | Clear offer and free CTA; weak proof, mixed primary CTA labels |
| Human readability (desktop) | **4** | Generally clear; hero lead text can look washed on dark gradient |
| Human readability (mobile) | **3** | Readable type, but header/nav wraps poorly and page gets long |
| Conversion clarity | **4** | Free path is obvious; paid path honestly deferred |

**Bottom line:** The sales site is now **customer-language** and broadly usable, but it still feels like a **set of similar templates** rather than one tight conversion system. Biggest issues: **inconsistent navigation**, **split CTA wording**, **auth pages leaking product chrome** (“Preview only — not sent to HMRC”), and **mobile header wrap**.

---

## 1. Consistency across pages

### What is consistent

- **Brand mark** “ST” + Spreadsheet Tax wordmark on every page.  
- **Primary blue** buttons (`#3b9eff`-family) and white cards.  
- **Light page background** `rgb(244, 246, 249)` on almost all marketing pages.  
- **Font stack** Segoe UI / system-ui across successful captures.  
- **Honesty footer** about independence / not HMRC-recognised appears widely.  
- **Audience pages** share the same two-column hero + steps layout (self-employed, landlords, professionals, firms).

### What is inconsistent

| Issue | Evidence |
|-------|----------|
| **Nav menus differ by page** | Home has full nav; self-employed only “Landlords · Pricing · Get started free”; help only “Sign in · Get started free”; legal only “Home”. |
| **Primary CTA labels** | Mix of **Get started free**, **Create free account**, **Create account** for the same action. |
| **Hero treatment** | Home + audience pages use dark gradient hero; pricing/help/legal use plain light header body. Feels like two brands. |
| **Auth vs marketing chrome** | Sign-in shows product **mode pill** (“Preview only — not sent to HMRC”) and “Marketing site” link — sales psychology broken. |
| **Forgot-password theme** | Capture metrics: body background `rgb(11, 18, 32)` (dark app shell) while rest of sales site is light. |
| **Secondary CTAs** | “Download free template” vs “Get free template”; “For accountants” vs “For larger firms” vs “Read licensing”. |

### Layout system

- Cards, rounded corners, and spacing are **mostly aligned**.  
- Pricing cards look polished and match home card language.  
- Security / privacy / terms are denser, more “document” than “sales” — acceptable if linked as legal, not sold as product pages.

---

## 2. Sales psychology evaluation

### Strengths (what works)

1. **Clear value proposition** on home: quarterly updates from the spreadsheet you already use.  
2. **Segmentation** “Who it’s for” (self-employed / landlords / accountants) — classic awareness → path choice.  
3. **Free primary offer** reduces friction; “paid plans not available yet” manages expectation (honest, not pushy).  
4. **How it works** 4-step card on home and dedicated page — lowers cognitive load.  
5. **Risk reversal** language: review/approve before send; recognition status disclosed (trust, UK MTD market).  
6. **Template secondary CTA** supports people not ready to register.

### Weaknesses (psychology gaps)

1. **No social proof** — no testimonials, case counts, firm logos, or “used by” (even soft). Weak authority/social proof.  
2. **No urgency** — fine for compliance software, but also no “next deadline” framing for MTD.  
3. **Split primary CTA** dilutes conversion memory (“Get started free” vs “Create free account”).  
4. **Too much honesty in hero trust list** — “paid plans not available yet” is correct but sits next to benefits; can dampen desire. Better in pricing only.  
5. **Sign-in page talks about product modes** — confuses cold traffic who clicked Sign in from sales.  
6. **Little emotional payoff** — mostly functional. Fine for tax, but benefits could be more outcome-led (“avoid retyping at deadline”).  
7. **Professional path** jumps to “Sign in to practice workspace” early — good for return users, weak for first-time practice buyers (no soft education).

### Funnel health (as designed)

```
Home → audience page → Get started free / Register
     → How it works / Template (assist)
     → Pricing (objection handling: free vs later)
     → Sign in (return users)
```

This is a sound simple funnel **if** nav and CTAs are unified.

---

## 3. Human-eye readability (browser)

### Desktop (1440×900)

| Check | Result |
|-------|--------|
| Body text ~16px slate | Good contrast on light panels |
| Headings dark slate on light | Good |
| Hero body text on dark gradient | **Risk:** lead copy can appear low-contrast / washed (dark grey on dark blue gradient) |
| Eyebrow ~11.8px teal | Slightly small; still legible |
| Buttons | High contrast white on blue |
| Line length | Home/cards OK; privacy/terms long but standard legal density |
| Whitespace | Generally generous; not cramped |

### Mobile (390×844)

| Check | Result |
|-------|--------|
| Type size | Readable; stacks well |
| Header/nav | **Poor:** links wrap to multiple rows; primary CTA becomes a full-width block under nav — looks broken |
| Sticky header height | Large, eats first screen |
| Page length | Home ~3600px; security/privacy/terms long scrolls — expected for legal |
| Tap targets | Buttons adequate |

### Accessibility-ish notes (visual only, not a full a11y audit)

- Almost no sub-12px body copy (good).  
- One ~11.8px eyebrow class appears often.  
- Mode pill on sign-in uses amber on light — readable but product-leaky.  
- No obvious white-on-white text in successful captures.

---

## 4. Page-by-page notes (desktop full)

| Page | Look & feel | Issues |
|------|-------------|--------|
| **Home** | Strongest sales page; clear hero + segments + benefits + final CTA | Hero lead contrast; CTA label mix; trust list includes “paid plans not available yet” |
| **Self-employed / landlords / pros / firms** | Clean audience heroes, consistent cards | Truncated nav; short pages OK |
| **How it works** | Clear 4 cards | Thin on proof |
| **Pricing** | Honest free vs coming later | No “Get started free” in body nav set fully matches home |
| **Templates** | Direct download CTA | Fine |
| **Security** | Customer-readable sections | Long; still a bit technical |
| **Help** | Task cards good | Sparse CTAs |
| **License / legal** | OK for secondary | Legal hub is light |
| **Privacy / terms** | Document layout | Long; fine for legal |
| **Sign-in** | Clean form | **Mode pill + “Marketing site” + “not the marketing website”** hurts sales continuity |
| **Register** | Clean | Align CTA with “Get started free” brand |
| **Forgot password** | Form OK | **Dark theme mismatch** vs sales site |

---

## 5. Priority fixes (sales site only)

**Full step-by-step execution plan:** [IMPROVEMENT-PLAN.md](./IMPROVEMENT-PLAN.md) (Phases A–G, page matrix, acceptance, tests, honesty gates).

### P0 — fix first

1. **Unify primary CTA label site-wide** → locked: **Get started free** (see plan §3).  
2. **Unify marketing header nav** on all sales pages (same links as home, responsive hamburger on mobile).  
3. **Remove product mode pill from sign-in/register/forgot** (or only show inside signed-in app).  
4. **Force light theme on forgot-password** to match sales.  
5. **Improve hero lead contrast** on dark gradient (lighter text or stronger scrim).

### P1 — conversion

6. Move “paid plans not available yet” off the home hero trust list → pricing only.  
7. Add one proof block (even soft: “Built for sole traders, landlords, and small practices” without fake metrics).  
8. Align secondary CTA labels (template / how it works).  
9. Mobile: collapse nav into menu so fold isn’t 50% chrome.

### P2 — polish

10. Shared footer links on every sales page.  
11. Slightly larger eyebrow text (≥13px).  
12. Keep security/privacy as trust pages; don’t overload home with legal density.

---

## 6. Scores by sales psychology principle

| Principle | Score | Note |
|-----------|:-----:|------|
| Clarity of offer | 4.5 | Immediately clear |
| Audience fit | 4 | Good segmentation |
| Trust / risk reduction | 4 | Recognition honesty; review before send |
| Social proof | 1.5 | Essentially none |
| Scarcity / urgency | 1 | None (OK for tax if intentional) |
| Friction to start | 4.5 | Free account path |
| Message consistency | 3 | CTA/nav drift |
| Visual system | 3.5 | Two hero styles; auth chrome leak |

---

## 7. How to open the captures

```text
docs/audits/2026-07-18-sales-site-review/
  REPORT.md                 ← this file
  capture-index.json        ← per-page metrics
  screenshots/
    01-home-sales-desktop-full.png
    01-home-sales-desktop-fold.png
    01-home-sales-desktop-scroll-top|mid|bottom.png
    01-home-sales-mobile-*.png
    02-self-employed-*.png
    … through 17-forgot-password-*.png
```

Re-run captures (server on port 3456):

```bash
# with app listening on :3456
# re-run the Playwright capture script from this review session
```

---

## 8. Evidence honesty

- Screenshots are from the **running app**, not mockups.  
- First capture attempt hit a wrong process on port 3456 (`Cannot GET`); **all report images are from the corrected restart** (all 200).  
- This is a **visual/UX sales review**, not an accessibility WCAG audit or conversion A/B test.
