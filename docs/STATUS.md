# Project status

**Last updated:** 2026-07-17 (automated session)  
**Highest proven gate:** **Gate 0 complete** · **Gate 1–2 foundation started** (auth, SQLite, drafts, workspace)

## Status 2026-07-17 — session progress

| Field | Value |
|-------|--------|
| Gate | 0 proven · pilot foundation (auth/drafts/workspace) in repo |
| Done this session | SQLite DB; register/login sessions; server-owned drafts; submit by draftId; authenticated `/workspace` + workflow; help/templates/signin/register; visual Playwright screenshots; auth-drafts tests |
| Tests | `npm test` **63 pass** · `npm run test:e2e` **12 pass** (smoke + visual) |
| Visual | Screenshots under `test-results/visual/` (local; gitignored) |
| Next | Formal ADR accepts; HMRC OAuth; fraud headers; billing; pen-test; interviews |
| Blocked external | HMRC production approval; legal counsel; paid pen-test |

### Demo credentials

- Email: `demo@spreadsheet-tax.example`  
- Password: `DemoPass123!`  
- Opens seeded practice clients in `/workspace`

### Env flags

| Variable | Effect |
|----------|--------|
| `HMRC_ALLOW_LIVE_SUBMIT=1` | Allow non-double submit (still needs token config) |
| `DEMO_PRACTICE_WRITES=1` | Unlock legacy unauthenticated practice PATCH |
| `DATA_DIR` / `SQLITE_PATH` | SQLite location |

### Allowed claims

- Free spreadsheet check; sign-in; save drafts; demo practice workspace  
- **Not:** production multi-tenant live HMRC for all customers  
