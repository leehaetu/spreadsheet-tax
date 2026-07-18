# Sales conversion — after high-conversion implementation

**Date:** 2026-07-18  
**Version:** 1.33.0  
**Base verified:** local `http://127.0.0.1:3456` (pre-deploy) + package version  
**Prior audit:** `docs/audits/2026-07-18-sales-conversion-review/`

## Definition of done (C1–C8)

| # | Criterion | Status | Evidence |
|---|-----------|:------:|----------|
| C1 | P0 visual fails fixed | **MET** | Trust list `rgb(255,255,255)`; secondary CTA white border+text; see fold PNGs |
| C2 | Clean product marketing image | **MET** | `public/images/app-review-fold.png` — review figures, no cookie, no dual mode pills |
| C3 | Free path dominates pricing | **MET** | Free full-width band; experimental under accordion |
| C4 | Mobile primary CTAs ≥ 44px | **MET** | Mobile hero primary ~54px; header primary 44px (`verify.json`) |
| C5 | Recapture pack | **PARTIAL** | Key folds + full home/pricing in this folder; full 89-route re-run after live deploy |
| C6 | Live `/health` matches ship | **PENDING deploy** | Ship 1.33.0 then curl |
| C7 | Funnel still works | **MET** | Register/sign-in/pricing CTAs intact; unit tests 242 pass |
| C8 | No fake proof / Recognised | **MET** | No fake testimonials; honest HMRC copy retained |

## Scorecard (local after)

| Lens | Before | After (local) |
|------|:------:|:-------------:|
| Visual consistency | 4.0 | **4.5** |
| Readability desktop | 3.5 | **4.8** |
| Readability mobile | 4.0 | **4.5** |
| Usability | 4.0 | **4.5** |
| Visual polish | 3.5 | **4.5** |
| Conversion psychology | 3.5 | **4.2** |
| Conversion readiness | 3.5 | **4.3** |

**Not claimed:** measured “very high % conversion”, pilot-ready product, capacity MET, live Stripe.

## P0 before → after

| Issue | Before | After |
|-------|--------|-------|
| Hero trust list | Washed out | Pure white, readable |
| Secondary CTA | Ghost invisible | White outline button |
| Product PNG | Cookie + dual pills | Review panel with £ figures only |
| Pricing hierarchy | 5 equal cards | Free featured; experimental collapsed |
| Register header | Duplicate Get started free | Sign in only |
| MFA on sign-in | (fixed 1.31.1) | Still hidden |

## Files shipped (this stream)

- `public/css/site.css` — hero contrast, on-dark CTA, 44px, pricing free band, deadline strip
- `public/sales.html`, `pricing.html`, audience/templates/help/security/how-it-works/register
- `public/js/sales-chrome.js` — register header, skip link, deadline strip
- `public/images/app-review-fold.png` — recaptured
- `scripts/capture-app-review-marketing.mjs`
- tests updated for pricing free-band

## Next after deploy

1. Curl live `/health` → 1.33.0  
2. `BASE_URL=<live> node scripts/audit-sales-live.mjs` full pack  
3. Weekly CTA event counts via `cta_events` table  
