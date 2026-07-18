# Product surface freeze (1.23)

**Date:** 2026-07-18  
**Rule:** Customer navigation and CTAs must not promise unfinished commercial or internal tools.

## Classification

Source of truth: `src/lib/product-surfaces.js` · runtime: `GET /api/product-surfaces`

| Class | Meaning |
|-------|---------|
| KEEP | Supported primary product surface |
| FIX | Keep visible; honesty / UX still incomplete |
| HIDE | Not in customer nav; may remain for operators |
| DELETE_LATER | Candidate for removal after migration |

## Hidden from customer nav

- `/billing` until `STRIPE_SECRET_KEY` (paymentsLive)
- `/mtd` (internal diagnostics)
- `/admin` (operator metrics)
- `/accountant`, `/practice` (fictional demo portfolios)

## Primary journey (keep)

Sales → register/signin → connect HMRC → `/app` quarterly → review → approve → submit (preview or sandbox) → history/receipts.

## Do not

- Add new public routes without updating the inventory  
- Market card billing or national capacity  
- Score HMRC non-2xx as success  
