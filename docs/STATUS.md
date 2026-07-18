# Project status

**Last updated:** 2026-07-18  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Goal (aspirational):** HMRC Recognised — **not achieved**  
**Evidence ledger:** [hmrc/ENDPOINT-EVIDENCE-LEDGER.md](./hmrc/ENDPOINT-EVIDENCE-LEDGER.md)  
**External deps:** [EXTERNAL-DEPENDENCIES.md](./EXTERNAL-DEPENDENCIES.md)  
**Cutover:** [PRODUCTION-CUTOVER.md](./PRODUCTION-CUTOVER.md)  

---

## Truth status (2026-07-18)

- **Stage: 2 of 5 — Sandbox engineering** (Gate 0 code unblocked; pilot/HMRC still external)
- **Not claiming:** production-ready · pilot-ready · HMRC Recognised · production-verified · every ledger row live 2xx
- **Customer quarterly journey (local):** sample → `#review-panel` → submit **WORKS** — `tests/e2e/app-journey.spec.js`
- **Practice isolation/roles:** draft ownership, firm-scoped reminders, admin invite/delete — `tests/tenant-isolation.test.js`
- **Year-end product workflows:** 16 known names on `/year-end` + `POST /api/workflows/run`; unknown rejected before preview; all names store receipt in preview — `tests/workflows-year-end.test.js`
- **Sandbox journey (rescored):** true2xx=**16** failed=**4** okish=**null** — `docs/hmrc/sandbox-journey-run.json` (live Playwright re-run blocked without Hub env — EXT)
- **Open remaining:** CSRF, MFA, launch-gate human sign-off, pilot, SDSTeam send, quiet live re-run of pending rows, Railway deploy of latest commit
- **Version:** **1.16.0**
- **Recognised:** **Not yet**
- **Sandbox app ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`
- **Production app:** not applied for

## Capability tags (summary)

| Area | Tag |
|------|-----|
| Unit suite 133 pass | UNIT_TESTED |
| Gate 0 browser journey | CUSTOMER_WORKFLOW (local e2e) |
| Tenant isolation | UNIT_TESTED |
| Production boot refusal | UNIT_TESTED |
| HMRC sandbox endpoints | Mixed SANDBOX_HTTP / preview — see ledger (exact statuses) |
| Production / Recognised | External |

## Demo login

`demo@spreadsheet-tax.example` / `DemoPass123!` — demo only.
