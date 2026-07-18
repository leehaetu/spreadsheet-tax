# Project status

**Last updated:** 2026-07-18  
**App version:** **1.20.0**  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Capacity gate:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) — **NOT MET**  
**Release gates:** [RELEASE-GATES.md](./RELEASE-GATES.md) — **OPEN** (tax, integrity, security, DR, ops, commercial…)  
**Live:** https://spreadsheet-tax-production.up.railway.app  

---

## Truth status (2026-07-18)

### Master completion rule

Code + scripts without executed production-like proof **≠ complete**.  
See final statement in `RELEASE-GATES.md`.

### Capacity (P0 — blocks all readiness claims)

- **Required:** **200** accounting practices + **800,000** self-employed/landlord customers **plus peak envelope** (deadline concurrency, not dormant rows only)  
- **Proven:** **No**  
- **Current platform:** 1× Railway web service, **SQLite default**, platform foundations optional via env  
- **Harness in-repo:** `npm run seed:capacity` (200 practices / 5k clients CI), `seed:capacity:full` (800k when Postgres), `load:capacity`  
- **Verdict:** **Not pilot-ready. Not production-ready. Not marketable at scale. Not complete.**  
- Also open: tax governance, submission integrity chain, agent authority, SQLite→PG migration rehearsal, deadline resilience, DR, pen-test, privacy lifecycle, WCAG, ops, billing (all in RELEASE-GATES)  

### HMRC / product (secondary until capacity gate opens)

- Unified SE / UK property / foreign journey foundation — **working**  
- Quarterly + cumulative YTD — **working**  
- Check your spreadsheet (cells, sheets, diff, comments) — **in 1.19+ product UI** (not Excel Online)  
- End-of-year guided tax-return **case** (stages + notes + HMRC steps) — **product journey in 1.20** (not fully E2E live-HMRC complete)  
- Practice work queue (full pipeline states, action labels, richer demo book) — **beyond pure demo UI in 1.20**; still not 25k-client production proof  
- HMRC Recognised / Production credentials: **external**, separate  
- Not HMRC-recognised  

### Forbidden claims until CAPACITY-REQUIREMENTS acceptance gate passes

- pilot-ready  
- production-ready  
- complete (as a product for market)  
- supports 200 practices / 800k customers  
- marketable at national scale  

### Version / deploy

- App code version **1.20.0** — EOY case + practice pipeline product work  
- Platform foundations in-repo — **version ≠ capacity gate MET**  
- See [PLATFORM-IMPLEMENTATION.md](./PLATFORM-IMPLEMENTATION.md)  
- Sandbox app ID: `e6751be5-fd22-4447-9e77-aa51729b1b46`  
- Production HMRC app: not applied for  

### Platform foundations shipped — still NOT capacity-complete

- Postgres pool + schema (`DATABASE_URL`)  
- Redis rate limits/locks/sessions (`REDIS_URL`)  
- Job queue + `npm run worker` (no autonomous HMRC)  
- Object quarantine + magic-byte types  
- First-class Excel via isolated child worker (LibreOffice container still TODO)  
- Seed + load harness (`seed:capacity`, `load:capacity`)  
- **Gate still open:** full 800k on HA Postgres + Redis + CAPACITY_CLAIM_FULL evidence  

## Evaluation snapshot (1.20)

| Area | State |
|------|--------|
| Unified SE/UK/foreign journey | Foundation working |
| Quarterly + cumulative YTD | Working |
| Check your spreadsheet | Product UI (cells, sheets, diff, comments) |
| End-of-year | Guided case stages (1.20) — not live-HMRC product-complete |
| Practice | Full pipeline + action labels + richer demo — not scale-proven |
| 200 practices / 800k | **NOT MET** (SQLite default) |
| Pilot / production / marketable | **No** |

## Immediate engineering priority order

1. **P0** Provision Railway Postgres + Redis; cut over app data path fully to Postgres  
2. **P0** LibreOffice disposable worker for .xls + formula recalc; ClamAV  
3. **P0** Full `seed:capacity:full` + deadline load evidence; then only claim capacity MET  
4. Then only: pilot claims, HMRC Production package, marketing  

## Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!` — **not** a scale test user base.
