# Project status

**Last updated:** 2026-07-18  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Capacity gate:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) — **NOT MET**  
**Live:** https://spreadsheet-tax-production.up.railway.app  

---

## Truth status (2026-07-18)

### Capacity (P0 — blocks all readiness claims)

- **Required:** **200** accounting practices + **800,000** self-employed/landlord customers  
- **Proven:** **No**  
- **Current platform:** 1× Railway web service, SQLite on single volume (~5 GB), in-process jobs/rate limits, no Redis/queue/object-storage workers  
- **Verdict:** **Not pilot-ready. Not production-ready. Not marketable at scale. Not complete.**  
- Infrastructure migration + load evidence **must** come before any readiness claim  

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

- App code version may be **1.16.x** on Railway — **version ≠ capacity**  
- Sandbox app ID: `e6751be5-fd22-4447-9e77-aa51729b1b46`  
- Production HMRC app: not applied for  

## Immediate engineering priority order

1. **P0** Capacity platform: Postgres, Redis, queues, workers, object storage, monitoring, backups  
2. **P0** Secure Excel workers (first-class xls/xlsx) on isolated workers  
3. **P0** Load/endurance/recovery tests against 200 practices + 800k records  
4. Then only: pilot claims, HMRC Production package, marketing  

## Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!` — **not** a scale test user base.
