# Live sales audit (executed)

**Base:** https://spreadsheet-tax-production.up.railway.app  
**When:** 2026-07-18  
**Method:** Playwright fold + full screenshots for 17 routes × desktop/mobile + primary CTA href checks + human visual review of key PNGs  
**Artifacts:** `screenshots/` (85 files), `defects.json`

## Automated pass

- 34/34 route×viewport HTTP 200  
- No mode pill on sales/auth  
- No “Create free account” primary CTAs  
- Hamburger present on mobile  

## Visual review defects found (and fixed)

| Sev | Issue | Fix |
|-----|--------|-----|
| **P0** | Home hero **trust list nearly invisible** (grey on dark gradient) | CSS: force light text + green checks on `.hero .trust-list` |
| **P0** | Sign-in showed **Authenticator** field always | Hide with `display:none` until MFA_REQUIRED |
| **P1** | Pricing five-up is dense on mid widths | Already stacks on mobile; desktop acceptable |

## Not defects (intentional honesty)

- Experimental paid prices not purchasable  
- Not HMRC-recognised copy on trust pages  
- S7 human interviews still external (cannot claim Sales complete)

## Orphan volume

- Legacy `postgres-volume` (unattached after old Postgres delete) set **pending deletion** / removed via Railway API.

## Screenshots to re-check after deploy

- `00-home-desktop-fold.png` — trust list must be clearly readable  
- `signin-desktop-fold.png` — only Email + Password until MFA  
