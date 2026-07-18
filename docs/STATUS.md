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

- **Stage: 2 of 5 — Sandbox engineering** (Gate 0 code fixes in progress toward Stage 3; pilot sign-off still external)
- **Not claiming:** production-ready · pilot-ready · HMRC Recognised · production-verified · full HMRC 2xx ledger
- **Customer quarterly journey (local):** sample → `#review-panel` → submit **WORKS** — evidence: `tests/e2e/app-journey.spec.js` (CUSTOMER_WORKFLOW local)
- **Practice isolation/roles:** **improved** — draft ownership, firm-scoped reminders, admin for invites/delete — evidence: `tests/tenant-isolation.test.js`
- **Year-end customer UI:** `/year-end` + `/api/workflows/run` with receipts — preview path UNIT_TESTED; live HMRC still needs token (SANDBOX_HTTP per ledger)
- **Open remaining:** CSRF, MFA, launch-gate human sign-off, pilot, SDSTeam submit, full ledger 2xx for every row, Railway deploy of this build
- **Version:** server `APP_VERSION` **1.16.0** · package.json may lag
- **Recognised:** **Not yet**
- **Sandbox app ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`
- **Production app:** not applied for

## Capability tags (summary)

| Area | Tag |
|------|-----|
| Unit suite | UNIT_TESTED (run locally) |
| Gate 0 browser journey | CUSTOMER_WORKFLOW (local e2e) |
| Tenant isolation | UNIT_TESTED |
| Production boot refusal | UNIT_TESTED |
| HMRC sandbox endpoints | Mixed SANDBOX_HTTP / ROUTE_ONLY — see ledger |
| Production / Recognised | External |

## Demo login

`demo@spreadsheet-tax.example` / `DemoPass123!` — demo only.
