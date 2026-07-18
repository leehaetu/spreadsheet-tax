# Sales website — after pack (post improvement plan)

**Date:** 2026-07-18  
**App version:** 1.26.0 (+ mode-pill fix in same ship)  
**Method:** Playwright Chromium via `scripts/capture-sales-site.mjs`  
**Base URL:** `http://127.0.0.1:3456`  
**Folder:** [after/screenshots/](./after/screenshots/)  
**Index:** [after/capture-index.json](./after/capture-index.json)  
**Plan:** [IMPROVEMENT-PLAN.md](./IMPROVEMENT-PLAN.md)  
**Before:** [REPORT.md](./REPORT.md) (1.25.x baseline, 140 PNGs)

---

## Capture inventory

| Metric | Count |
|--------|------:|
| Routes | 17 sales/auth |
| Viewports | 2 (desktop 1440×900, mobile 390×844) |
| Route×viewport HTTP 200 | **34/34** |
| `data-sales-nav="v1"` after JS | **34/34** |
| Mode pill on sales/auth | **0/34** (correct) |
| “Create free account” primary CTAs | **0** |
| Extra product shots | app review fold/full; product home mode pill |

---

## Scorecard (before → after)

| Lens | Before | After | Evidence |
|------|:------:|:-----:|----------|
| Visual consistency | 3.5 | **4.5** | Shared sales-chrome nav/footer on all 17 routes; metrics `salesNav: v1` |
| Sales psychology | 3.5 | **4.0** | One primary CTA; soft proof; paid-deferred on pricing only; no fake metrics |
| Readability desktop | 4.0 | **4.5** | Hero lead `rgb(232, 238, 247)`; eyebrow **13px** |
| Readability mobile | 3.0 | **4.0** | Hamburger `display:flex`; desktop nav `none`; drawer closed by default |
| Conversion clarity | 4.0 | **4.5** | Get started free site-wide; `data-cta` + analytics.js beacon [UNIT_TESTED] |

**Targets from plan:** all met (≥4.5 consistency, ≥4.0 psychology, ≥4.5 desktop, ≥4.0 mobile, ≥4.5 conversion).

---

## Acceptance verification (executed)

### Phase A

| Check | Result |
|-------|--------|
| sales-chrome.js inject on marketing + auth | Pass (34/34 index + unit tests) |
| `header[data-sales-nav="v1"]` after JS | Pass |
| Mobile hamburger, no multi-row desktop nav | Pass (`toggleDisplay:flex`, `desktopNav:none`) |
| Shared footer links | Pass (sales-chrome footer) |
| Primary CTA = Get started free | Pass (0 Create free account in CTAs) |
| Mode pill off sign-in/register/forgot | Pass |
| Forgot-password light bg | Pass `rgb(244, 246, 249)` |
| Mode pill on product `/home` | Pass after control-centre fix: “Preview only — not sent to HMRC” |
| Hero lead contrast | Pass light lead on dark hero |
| Eyebrow ≥13px | Pass `13px` |
| Unit tests | Pass (sales-chrome suite + full npm test) |

### Phase B–F

| Check | Result |
|-------|--------|
| Pricing owns paid-deferred honesty | Pass [UNIT_TESTED] |
| Soft proof on home (no fake counts) | Pass (copy + screenshots) |
| Professionals first-time education | Pass |
| Auth brand continuity | Pass (sales nav, light theme) |
| Legal pages shared chrome | Pass inject |
| analytics.js on marketing | Pass inject + POST `/api/analytics/cta` → 200 |
| How-it-works real app review image | Pass `/images/app-review-fold.png` + after shot 18 |

### Phase G

| Check | Result |
|-------|--------|
| After pack on disk | Pass `after/screenshots/` (~140+ PNGs) |
| Durable capture script | Pass `npm run capture:sales` |
| STATUS evidence-tagged | Updated this ship |
| Not claiming pilot/production/recognised | Honest |

---

## 10-second moderated structure review (S7 proxy — agent, not live users)

**Method:** For each primary landing, open fold PNG and answer within ~10 seconds: “What is this?” “Who is it for?” “What do I click?”

| Page | 10s answer | Pass? |
|------|------------|:-----:|
| Home | Quarterly updates from your spreadsheet; free start | Yes |
| Self-employed | Trade spreadsheet → quarterly | Yes |
| Landlords | Rental path | Yes |
| Professionals | Practice workflow + free start | Yes |
| Pricing | Free now; paid later explicit | Yes |
| Sign-in | Return users; get started free nearby | Yes |
| Register | Create account / get started free | Yes |

**Honest limit:** This is **agent structure review**, not moderated interviews with 5 SE / 5 landlords / 5 pros / 2 firms. COMPLETION-PLAN S7 human interviews remain **external / open**.

---

## Residual issues (not blockers for this wave)

1. **Double header flash** possible before sales-chrome replaces static header (progressive enhancement).  
2. **Product `/home` control-centre** has no classic top nav — mode pill injects at body top (visible in shot 19). Acceptable.  
3. **Human S7 interviews** still open.  
4. **Deployed Railway after-pack** not re-run here (local :3456 evidence only).

---

## How to re-run

```bash
PORT=3456 node src/server.js
# other terminal:
npm run capture:sales
# or:
BASE_URL=http://127.0.0.1:3456 \
  OUT_DIR=docs/audits/2026-07-18-sales-site-review/after/screenshots \
  INDEX_PATH=docs/audits/2026-07-18-sales-site-review/after/capture-index.json \
  node scripts/capture-sales-site.mjs
```

---

## Honesty

- Screenshots are from the **running app** at v1.26.x, not mockups.  
- Scores are visual/UX judgment against the same rubric as REPORT.md.  
- Completing this after pack does **not** mean pilot-ready, capacity met, or HMRC Recognised.
