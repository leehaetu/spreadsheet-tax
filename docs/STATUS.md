# Project status

**Last updated:** 2026-07-18  
**App version:** **1.22.0**  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Capacity gate:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) — **NOT MET**  
**Release gates:** [RELEASE-GATES.md](./RELEASE-GATES.md) — **OPEN**  
**Live:** https://spreadsheet-tax-production.up.railway.app  

---

## Truth status (2026-07-18)

### Operational product readiness (1.22) — software for production APIs

When **production HMRC credentials** and host env are supplied:

| Capability | State |
|------------|--------|
| Production host from `HMRC_OAUTH_ENV` / `HMRC_BASE_URL` only | **Yes** |
| No live HTTP without real OAuth token | **Yes** (client_id alone → double) |
| Live submit requires `HMRC_ALLOW_LIVE_SUBMIT=1` + token + figure approval | **Yes** |
| SE + UK + foreign quarterly + amend + EOY workflows | **Yes** (product + preview; live when token) |
| Evidence pack per attempt | **Yes** |
| Worker `hmrc_submit` with `userApproved` gate | **Yes** (wired to real submit path) |
| `ASYNC_HMRC_SUBMIT=1` queue path | **Yes** |
| Postgres SoR dual-write when `DATABASE_URL` | **Yes** (users, sessions, drafts, clients, attempts, audit) |
| HTTP `/api/submit` uses unified `performProductSubmit` | **Yes** |
| Queue worker requires durable figure-hash approval | **Yes** (no re-self-approve) |
| Production boot refuses weak secrets / prod live without Hub client | **Yes** |
| Capacity 200/800k proven | **NOT MET** — never claimed from DATABASE_URL alone |
| HMRC Recognised | **No** (external) |
| Pilot / marketable at scale | **No** |

### Forbidden claims until capacity + release gates pass

- pilot-ready · production-ready · complete · marketable at scale · supports 200/800k  

### Tests

- Unit/workflow: **184 pass**  
- Playwright smoke + app-journey: **10 pass**  

### Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!`
