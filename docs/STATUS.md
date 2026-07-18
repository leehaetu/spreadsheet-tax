# Project status

**Last updated:** 2026-07-18  
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
- **Current platform:** 1× Railway web service, SQLite default, platform foundations optional via env  
- **Verdict:** **Not pilot-ready. Not production-ready. Not marketable at scale. Not complete.**  
- Also open: tax governance, submission integrity chain, agent authority, SQLite→PG migration rehearsal, deadline resilience, DR, pen-test, privacy lifecycle, WCAG, ops, billing (all in RELEASE-GATES)  

### HMRC / product (secondary until capacity gate opens)

- Stage for **software bridging features** may progress, but **must not** be sold as pilot/production ready while capacity gate is open  
- Gate 0 customer journey fixes, isolation work, year-end workflows exist in code — **insufficient alone**  
- HMRC Recognised / Production credentials: **external**, separate  
- Not HMRC-recognised  

### Forbidden claims until CAPACITY-REQUIREMENTS acceptance gate passes

- pilot-ready  
- production-ready  
- complete (as a product for market)  
- supports 200 practices / 800k customers  
- marketable at national scale  

### Version / deploy

- App code version **1.17.0** — platform foundations in-repo — **version ≠ capacity gate MET**  
- See [PLATFORM-IMPLEMENTATION.md](./PLATFORM-IMPLEMENTATION.md)  
- Sandbox app ID: `e6751be5-fd22-4447-9e77-aa51729b1b46`  
- Production HMRC app: not applied for  

### Platform foundations shipped (1.17.0) — still NOT capacity-complete

- Postgres pool + schema (`DATABASE_URL`)  
- Redis rate limits/locks/sessions (`REDIS_URL`)  
- Job queue + `npm run worker` (no autonomous HMRC)  
- Object quarantine + magic-byte types  
- First-class Excel via isolated child worker (LibreOffice container still TODO)  
- Seed + load harness (`seed:capacity`, `load:capacity`)  
- **Gate still open:** full 800k on HA Postgres + Redis + CAPACITY_CLAIM_FULL evidence  

## Immediate engineering priority order

1. **P0** Provision Railway Postgres + Redis; cut over app data path fully to Postgres  
2. **P0** LibreOffice disposable worker for .xls + formula recalc; ClamAV  
3. **P0** Full `seed:capacity:full` + deadline load evidence; then only claim capacity MET  
4. Then only: pilot claims, HMRC Production package, marketing  

## Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!` — **not** a scale test user base.
