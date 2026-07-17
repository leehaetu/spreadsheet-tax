# Project status

**Last updated:** 2026-07-17  
**Highest proven gate:** **Gate 0 — Safe demo** (repo controls implemented)

## Status 2026-07-17

| Field | Value |
|-------|--------|
| Gate | **0 Safe demo** — proven in repo |
| Done | Credential-isolated submit (double default); practice write freeze; privacy copy; docs OS; CI; Playwright smoke; sales pages pricing/how-it-works/security; Gate 0 tests |
| In progress | Push to origin; customer interviews; Gate 1 ADRs formal accept |
| Blocked / external | HMRC production approval; legal pack; pen-test; billing |
| Tests | `npm test` **59 pass** · `npm run test:e2e` **6 pass** |
| Next | Auth + Postgres (Gate 1–2); deepen sales conversion; interviews |

### Gate 0 checklist

| Item | Status |
|------|--------|
| 0.1 Commit docs + intentional WIP | this commit |
| 0.2 No anonymous credentialed HMRC submit | **done** (`HMRC_ALLOW_LIVE_SUBMIT` required for live) |
| 0.3 Privacy claims accurate | **done** |
| 0.4 CI | **done** (`.github/workflows/ci.yml`) |
| 0.5 Cumulative-update decision | **done** (ADR 0011 pending research) |
| 0.6 Practice writes frozen | **done** (403 unless `DEMO_PRACTICE_WRITES=1`) |
| 0.7 Package names | documented |
| 0.9 Data model / ADRs | drafted; 0008 direction accepted |

### Allowed external claims

- Try spreadsheet check / demo preview submit  
- **Not yet:** production-ready multi-tenant live HMRC practice product  
