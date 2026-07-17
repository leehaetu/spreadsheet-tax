# Project status

**Last updated:** 2026-07-17 (continuous session)  
**Highest proven gate:** **Gate 0 complete** · **Pilot foundation largely in-repo** (auth, drafts, workspace, OAuth mock, fraud headers, billing stub)

## Status slice — HMRC OAuth + fraud headers + billing

| Field | Value |
|-------|--------|
| Gate | 0 proven; pilot features present with mock OAuth |
| Done | Encrypted HMRC token storage; OAuth authorize/callback (mock or real credentials); fraud-prevention headers on API requests; plan entitlements stub; rate limit on submit; account/billing/connect pages; legal privacy summary |
| Tests | unit **66 pass** · e2e **15 pass** (incl. visual + mock HMRC connect) |
| Visual | Screenshots regenerated (sales, app, workspace, billing, connect) |
| Commits | Continuous push to main |
| Next / external | Real HMRC Developer Hub app + production approval; card billing; pen-test; interviews; WCAG audit sign-off |

### Demo credentials

`demo@spreadsheet-tax.example` / `DemoPass123!`

### Key URLs

| Path | Purpose |
|------|---------|
| `/app` | Free spreadsheet check |
| `/signin` | Auth |
| `/workspace` | Practice clients |
| `/connect-hmrc` | OAuth connect (mock by default) |
| `/billing` | Plan select (no charges) |
| `/account` | Account summary |

### Env

| Variable | Meaning |
|----------|---------|
| `HMRC_CLIENT_ID` / `HMRC_CLIENT_SECRET` / `HMRC_REDIRECT_URI` | Real OAuth |
| `HMRC_OAUTH_MOCK=1` | Force mock connect (default when no client id) |
| `HMRC_ALLOW_LIVE_SUBMIT=1` | Allow non-double submit with user/env token |
| `TOKEN_ENCRYPTION_KEY` or `SESSION_SECRET` | Token encryption at rest |

### Honest claims

- **Yes:** demo product with safe preview submit, sign-in, drafts, mock HMRC connect, practice workspace  
- **No:** independent pen-test passed; production HMRC approval; real card billing; “complete” launch gate  
