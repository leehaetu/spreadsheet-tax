# Project status

**Last updated:** 2026-07-18  
**App version:** **1.21.0**  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Capacity gate:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) — **NOT MET**  
**Release gates:** [RELEASE-GATES.md](./RELEASE-GATES.md) — **OPEN**  
**Live:** https://spreadsheet-tax-production.up.railway.app  

---

## Truth status (2026-07-18)

### Master completion rule

Code + scripts without executed production-like proof **≠ complete**.  
See final statement in `RELEASE-GATES.md`.

### Capacity (P0 — blocks all readiness claims)

- **Required:** **200** practices + **800,000** customers **plus peak envelope**  
- **Proven:** **No**  
- **Current platform:** SQLite default; Postgres/Redis/queue foundations + `migrate:sqlite-to-pg` helper  
- **Verdict:** **Not pilot-ready. Not production-ready. Not marketable at scale.**

### Product capability (1.21) — what the software does

| Area | State |
|------|--------|
| Unified SE / UK / foreign journey | Working foundation |
| Quarterly + cumulative YTD | Working |
| Check your spreadsheet | Product UI (cells, sheets, diff, comments) |
| **Server-enforced approval + figure lock** | **Yes (1.21)** — cannot bypass with raw `/api/submit` |
| **Integrity evidence pack** | **Yes** — correlation id, figure hash, approval, `/api/receipts/:id/evidence` |
| Corrections SE + UK + foreign amend | **Yes** (product workflows) |
| EOY guided case | Stages + annual-from-draft + BSAS multi-source + periods of account |
| Practice work queue | Full pipeline + action labels + dual-control block for bookkeeper self-approve |
| 200 / 800k | **NOT MET** |
| Pilot / production / marketable | **No** |
| HMRC Recognised | **No** (external) |

### Unit tests

**171 pass** (`npm test`) on 1.21

### Forbidden claims until capacity + release gates pass

- pilot-ready · production-ready · complete · marketable at scale · supports 200/800k

### External (not closed by code alone)

HMRC Production credentials · HMRC Recognised · pen-test · independent tax review · real pilot customers · HA Postgres ops on Railway with load evidence

### Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!`
