# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Version target:** 1.9.0 (deploy after push)  
**Truth audit:** [TRUTH-AUDIT.md](./TRUTH-AUDIT.md)  
**Production APIs pack:** [HMRC-PRODUCTION-ACCESS.md](./HMRC-PRODUCTION-ACCESS.md)

## Priority (Lee)

Spreadsheet Tax first. Home-based (Reading area / prefer **Wokingham**). Plumbing customers deprioritised; gas licence maybe later. Both apps Railway-deployed.

## Current truth (do not soften)

| Fact | Value |
|------|--------|
| OAuth mock | **Off** (`HMRC_OAUTH_MOCK=0`) |
| Hub credentials | **Set** on Railway (**sandbox** app) |
| Default public submit | Preview/double unless live flag + real token |
| Sandbox SE period submit | **Done once** (fixture plumber CSV → 200 + periodId) |
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

## Operator next (truthful)

1. Confirm **Obligations (MTD) 3.0** subscribed on Sandbox Hub app  
2. Connect sandbox → Load businesses + obligations on `/app`  
3. Set `VENDOR_PUBLIC_IP` if Railway egress known  
4. Create **Production** application on Hub + email SDSTeam (template in production pack)  
5. Complete HMRC Production Approvals Checklist when issued  
6. Do **not** claim live taxpayer filing until approval + gate  

## Honesty rule for agents

**Truth first.** See `AGENTS.md` and `docs/TRUTH-AUDIT.md`. Never invent FPH or outcomes.
