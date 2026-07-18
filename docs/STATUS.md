# Project status

**Last updated:** 2026-07-18  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md) · template: [STATUS-CLAIM-TEMPLATE.md](./STATUS-CLAIM-TEMPLATE.md)  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Goal (aspirational):** HMRC Recognised — **not achieved**  
**Truth audit:** [TRUTH-AUDIT.md](./TRUTH-AUDIT.md)  

---

## Truth status (2026-07-18)

- **Stage: 2 of 5 — Sandbox engineering**
- **Not claiming:** production-ready · pilot-ready · HMRC Recognised · full operational E2E product · HMRC walkthrough ready
- **Open P0 blockers:**
  - Broken customer app review journey (HTML `review-panel` vs JS `preview-panel` and related IDs)
  - Draft submit without ownership check
  - Cross-tenant deadline reminders
  - Incomplete server-side role enforcement
  - Insecure token-encryption / cookie defaults for production
  - Vulnerable `xlsx` parser (high, no fix on package)
  - Journey scorer can mark non-2xx as ok
- **Customer quarterly journey:** **BROKEN** (Gate 0) — evidence: `public/app.html` vs `public/js/app.js`
- **Practice isolation/roles:** **FAIL** (membership ≠ role checks; reminders global)
- **Latest sandbox journey:** do **not** quote “all green”; list each step’s real HMRC status from `docs/hmrc/sandbox-journey-run.json` when reporting
- **Version drift:** server `APP_VERSION` **1.15.0** · `package.json` **1.0.0** · older docs may say 1.10.0 — reconcile before any external claim
- **Recognised status:** **Not yet** (must stay false until listed)
- **Sandbox app ID:** `e6751be5-fd22-4447-9e77-aa51729b1b46`
- **Production app:** not applied for (Lee approval required before any SDSTeam “ready” email)

---

## What is genuinely working (tagged)

| Claim | Tag | Notes |
|-------|-----|--------|
| Unit/integration suite 117 pass | `UNIT_TESTED` | Not customer e2e proof |
| Auth, firms, clients, drafts, OAuth rows in SQLite | `UNIT_TESTED` / product code | Exists; isolation incomplete |
| HMRC sandbox OAuth | `SANDBOX_HTTP` / e2e history | Real when credentials + non-mock |
| Many MTD routes under `/api/hmrc/mtd/*` | `ROUTE_ONLY` (+ some `SANDBOX_HTTP`) | **Not** full customer workflows |
| SE / some property / calcs / BSAS / ITSA / BISS hits in journey file | `SANDBOX_HTTP` (per step) | Report step-by-step; never bulk “success” |
| Practice workspace UI shell | `ROUTE_ONLY` / partial UX | Stronger than `/mtd`; not secure pilot |
| Production host switch env-based | `UNIT_TESTED` | Code path; Production credentials **not** granted |
| Default public submit = preview | product truth | Live submit gated |

---

## Priority (Lee)

Spreadsheet Tax first. Prefer Wokingham / home hours. Both apps Railway-deployed.

## Demo product login

`demo@spreadsheet-tax.example` / `DemoPass123!` — **demo/test**, not a real taxpayer.

## Operator next (honest)

1. **Gate 0:** repair app HTML/JS journey + ownership/isolation P0s  
2. Secure pilot baseline (SECURITY-LAUNCH-GATE evidence + human sign-off)  
3. Real customer quarterly + EOY workflows (not `/mtd` as product)  
4. Endpoint evidence ledger with true HMRC statuses  
5. Only then: checklist + SDSTeam with Lee approval  
6. Never claim live taxpayer filing until Production approval + gate  

## Honesty rule for agents

Read `AGENT-TRUTH-PROTOCOL.md` first. Overclaim = protocol breach → correct immediately + row in `TRUTH-AUDIT.md`.
