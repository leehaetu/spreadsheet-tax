# HMRC sandbox pilot — operator runbook

**Status (2026-07-17):** Hello World connectivity **PASS** (open + application).  
Credentials on Railway; `HMRC_OAUTH_MOCK=0`; period live submit still **off**.

## Confirmed API subscriptions

Required: SE Business 5.0 · Property Business 6.0 · Fraud Headers Test 1.0 · SA Test Support 1.0 · Create Test User 1.0 · Business Details 2.0 · Obligations 3.0 · Hello World 1.0  

Optional kept: BISS 3.0 · BSAS 7.0 · Individual Calculations 8.0  

## Connectivity

```bash
curl -s https://spreadsheet-tax-production.up.railway.app/api/hmrc/sandbox-check | jq .
```

Expect `ok: true`, `openAccess.ok`, `application.ok`, `mock: false`.

## Test user (created via Create Test User API)

Stored on Railway as:

- `HMRC_SANDBOX_TEST_USER_ID`
- `HMRC_SANDBOX_TEST_USER_PASSWORD` (reveal only if `DEMO_SHOW_TEST_PASSWORD=1`)
- `HMRC_SANDBOX_TEST_NINO`
- `HMRC_SANDBOX_TEST_MTD_IT_ID`
- `HMRC_SANDBOX_TEST_SA_UTR`

Signed-in operator can also:

- `GET /api/hmrc/sandbox-test-user`
- `POST /api/hmrc/create-test-user` (creates a **new** user each time)

## Connect journey (needs browser — HMRC sign-in)

1. Register/sign in to Spreadsheet Tax: https://spreadsheet-tax-production.up.railway.app/signin  
2. Open https://spreadsheet-tax-production.up.railway.app/connect-hmrc  
3. Click **Start connect journey**  
4. At HMRC sandbox login, use **test userId + password** (not your Hub developer login)  
5. Approve scopes `read:self-assessment` `write:self-assessment`  
6. Return to app — status should show real sandbox connection (`mock: false`, `connected: true`)

## After connect

1. **Validate fraud headers** button on connect page  
2. Import a sample period in `/app`  
3. Only when ready: set `HMRC_ALLOW_LIVE_SUBMIT=1` for a **controlled** sandbox period POST  

## Security

- Never commit test passwords to git  
- Rotate Hub client secret if it was pasted in chat  
- Keep `HMRC_ALLOW_LIVE_SUBMIT=0` until OAuth + headers verified  
