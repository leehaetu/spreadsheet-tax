# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Live app version:** confirm via `/health` → `version` / `appVersion` (semantic software release — **not** HMRC recognition ID)  
**HMRC recognised:** **No** — site-wide banner + footer via `site-chrome.js`; flip only in `src/lib/hmrc-recognition.js` when granted  
**Truth inventory:** [DONE-VS-NOT.md](./DONE-VS-NOT.md) ← read this before “next steps”  
**Truth audit:** [TRUTH-AUDIT.md](./TRUTH-AUDIT.md)  
**Production APIs pack:** [HMRC-PRODUCTION-ACCESS.md](./HMRC-PRODUCTION-ACCESS.md) (only when sandbox evidence is enough)

## Priority (Lee)

Spreadsheet Tax first. Home-based (Reading area / prefer **Wokingham**). Plumbing customers deprioritised; gas licence maybe later. Both apps Railway-deployed.

## Current truth (do not soften)

| Fact | Value |
|------|--------|
| OAuth mock | **Off** (`HMRC_OAUTH_MOCK=0`) |
| Hub credentials | **Set** on Railway (**sandbox** app) |
| Default public submit | Preview/double unless live flag + real token |
| Sandbox SE period submit | **Done once** (fixture plumber CSV → 200 + periodId) |
| Sandbox UK/foreign property submit | **Code paths shipped** (`/api/hmrc/sandbox-submit-uk` / `-foreign`) — run with OAuth + draft to prove HTTP 200 |
| Business Details | Sandbox list proven; UI “Load businesses” on `/app` |
| Obligations | API + UI shipped (`GET /api/hmrc/obligations`) — re-test with connected token |
| Tax estimate | **Signpost** to HMRC account — not calculated in-app |
| FPH | **Honest omit**; not full VALID_HEADERS |
| Production HMRC APIs | **Not granted** — Hub Production app + checklist still required |
| Billing | Stub — no cards |
| Email | Stub unless webhook |
| Demo portfolio | Fictional, labelled |

## Demo product login

`demo@spreadsheet-tax.example` / `DemoPass123!`

## MVP vs production APIs

| Track | Status |
|-------|--------|
| **Personal pilot MVP** | Largely in place: auth, drafts, import, review, OAuth, sandbox SE submit, history/receipts, businesses/obligations UI |
| **HMRC Production credentials** | Operator process on Hub — see production pack |

## Operator next (truthful — only open items)

1. ~~VENDOR_PUBLIC_IP~~ **done** — Railway egress `195.180.20.214`  
2. ~~In-year Hub API subscriptions~~ **you already have them**  
3. ~~OAuth + businesses + obligations e2e~~ **Playwright 5/5 passed** (production + sandbox test user)  
4. Property sandbox period HTTP evidence when you want SDSTeam logs for Property 6.0  
5. **Not next yet:** Production Hub application — only after you are happy with sandbox evidence  
6. Never claim live taxpayer filing until Production approval + gate  

See [DONE-VS-NOT.md](./DONE-VS-NOT.md).

## Honesty rule for agents

**Truth first.** See `AGENTS.md` and `docs/TRUTH-AUDIT.md`. Never invent FPH or outcomes.
