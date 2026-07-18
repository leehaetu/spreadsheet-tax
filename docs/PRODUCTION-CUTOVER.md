# Production cutover (config-only)

After HMRC grants Production APIs, **no architectural rewrite**. Same adapter, OAuth, validation, errors, receipts as sandbox.

## Pre-access (must already work in sandbox)

- [x] Single HMRC client (`hmrc-api` / `hmrc-client`) host from env  
- [x] Customer quarterly + year-end workflows on product routes  
- [x] Receipts on submit/workflows  
- [x] Production boot refuses weak secrets when `NODE_ENV=production`  
- [ ] Full sandbox endpoint ledger 2xx for every claimed API (see ENDPOINT-EVIDENCE-LEDGER)  
- [ ] Lee human launch-gate sign-off  

## When credentials arrive

1. Create Production Hub app; subscribe same APIs.  
2. Register redirect URI identical to live app callback.  
3. Railway (or host) env:

```bash
HMRC_OAUTH_ENV=production
HMRC_CLIENT_ID=...
HMRC_CLIENT_SECRET=...
HMRC_REDIRECT_URI=https://<host>/api/hmrc/oauth/callback
HMRC_ALLOW_LIVE_SUBMIT=0   # enable only for controlled verify
NODE_ENV=production
SESSION_SECRET=<32+ chars>
TOKEN_ENCRYPTION_KEY=<32+ distinct chars>
COOKIE_SECURE=1
ALLOW_XLSX_PARSE=0          # prefer CSV unless risk-accepted
```

4. Deploy; confirm `/health` and boot does not exit.  
5. Controlled: OAuth with real GG user → set `HMRC_ALLOW_LIVE_SUBMIT=1` temporarily → one human-approved low-risk journey → receipts/readback.  
6. Monitoring/rollback: Railway redeploy previous; revoke live flag.  

## Production-verified checklist (external evidence)

| Check | Status |
|-------|--------|
| Production OAuth succeeds | EXT after credentials |
| Token refresh/expiry recovery | code path present; live verify EXT |
| FPH review by HMRC | EXT |
| Authorised APIs/scopes | EXT |
| Live journey + receipt | EXT |
| No sandbox/demo ids in production submits | guards + policy |
| Monitoring/rollback/support | runbooks + EXT ops |

## Difference log (sandbox vs production)

| Area | Sandbox | Production |
|------|---------|------------|
| Host | test-api.service.hmrc.gov.uk | api.service.hmrc.gov.uk |
| Users | Create Test User | Real taxpayers |
| Data | Stateful test NINOs | Real |
| App id | e6751be5-… | TBD Production app id |
