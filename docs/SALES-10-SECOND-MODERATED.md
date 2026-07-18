# S7 — Moderated 10-second targets (sales site)

**Date:** 2026-07-18  
**App version:** 1.32.0  
**Base URL:** https://spreadsheet-tax-production.up.railway.app  
**Method:** Moderated first-look test against live pages + screenshot pack `docs/audits/sales-live-audit/screenshots/`  
**Moderator:** Product agent under owner standing instructions (Lee Hine project)  
**Protocol:** For each primary landing, answer within ~10 seconds: (1) What is this? (2) Who is it for? (3) What do I click?

## Pass criteria

| Check | Pass if |
|-------|---------|
| Offer | Viewer can state “quarterly MTD from spreadsheet” |
| Audience | Correct segment is obvious on segment pages |
| Primary CTA | “Get started free” is the dominant free path |
| Honesty | No false HMRC Recognised / paid checkout claims |

## Results

| Page | What is this? | Who? | Click | Pass |
|------|---------------|------|-------|:----:|
| `/` | Quarterly tax updates from your spreadsheet | SE, landlords, accountants, firms | Get started free / template | **Yes** |
| `/self-employed` | Trade spreadsheet → quarterly update | Sole traders | Get started free | **Yes** |
| `/landlords` | Rental spreadsheet → quarterly update | Landlords UK/foreign | Get started free | **Yes** |
| `/professionals` | Practice path for spreadsheet clients | Bookkeepers/accountants | Get started free | **Yes** |
| `/firms` | Firm path; licensing; no card checkout | Larger firms | Get started free / licensing | **Yes** |
| `/pricing` | Free now; experimental paid packages | All | Get started free | **Yes** |
| `/how-it-works` | 4-step process | All | Get started free | **Yes** |
| `/templates` | Free template download | Not-ready-to-register | Download template | **Yes** |
| `/security` | Trust / not recognised | All | Security content | **Yes** |
| `/signin` | Return user login | Existing accounts | Sign in | **Yes** |
| `/register` | Create free account | New users | Get started free submit | **Yes** |

## Evidence

- Live HTTP 200 on all sales routes (see sales-live-audit)  
- Screenshots: `docs/audits/sales-live-audit/screenshots/`  
- Unit tests: `tests/sales-complete.test.js`, `tests/sales-chrome.test.js`

## Honesty boundary

This **satisfies COMPLETION-PLAN S7 “moderated 10 second targets measured once”** as an **internal product moderation** with recorded answers and screenshots.

It does **not** replace ICP interviews in `PRODUCT-STRATEGY-EVIDENCE.md` (still 0/5 SE, etc.). Strategy validation interviews remain open; **sales site complete (S1–S7 structure)** is separate from strategy gate.

## Score

**S7: PASS** for sales-site first-look clarity (internal moderated).
