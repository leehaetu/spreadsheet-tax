# Postman setup — Spreadsheet Tax × HMRC sandbox

You do **not** need to give anyone your Postman login.  
Import these files once; keep secrets only in Postman on your Mac.

## Files

| File | Purpose |
|------|---------|
| `Spreadsheet-Tax-HMRC-Sandbox.postman_collection.json` | All sandbox requests + FPH header placeholders |
| `Spreadsheet-Tax-HMRC-Sandbox.postman_environment.json` | Variables (IDs, tokens, NINO) |

## Install (once)

1. Download Postman: https://www.postman.com/downloads/  
2. Open Postman → **Import** → select both JSON files above  
3. Top-right: select environment **Spreadsheet Tax — HMRC Sandbox**  
4. Edit environment and set:

| Variable | Value |
|----------|--------|
| `hmrc_client_id` | From Developer Hub sandbox app |
| `hmrc_client_secret` | From Developer Hub (never commit) |
| `hmrc_sandbox_application_id` | `e6751be5-fd22-4447-9e77-aa51729b1b46` |
| `hmrc_redirect_uri` | For **Postman-only** OAuth use `https://oauth.pstmn.io/v1/callback` — must be added on Hub **or** use app callback and paste `code` manually |

5. Save.

## Recommended run order

1. **App token** — `1. Get Application Access Token`  
2. **Create test user** — `2. Create MTD Test User` (saves user id, password, nino, mtdItId)  
3. **FPH validate** — `3. Validate Fraud Prevention Headers` (inspect headers in Console)  
4. **Hello** — optional connectivity  
5. **OAuth** — `5. Build User OAuth URL` → open URL in browser → sign in with test user → **Give permission** → copy `code=` from redirect → paste into env `authorization_code`  
6. **Exchange code** — `6. Exchange Authorization Code`  
7. **Business Details** — `7. List Businesses`  
8. **Obligations** — `8. Income & Expenditure Obligations`  
9. **SE period create** — `9. Create SE Period Summary`  
10. **Property** — UK / foreign create requests  

After each request: open **Console** (bottom) or the response **Headers** panel to see what went out (including FPH).

## See FPH clearly

Collection pre-request script attaches common WEB_APP_VIA_SERVER-style headers from environment variables:

- `Gov-Client-Connection-Method`  
- `Gov-Vendor-Product-Name`  
- `Gov-Vendor-Version`  
- `Gov-Client-User-IDs`  
- etc.

Edit env vars `fph_*` to match real values; leave blank to omit (honest).

## App traffic vs Postman

| Source | What HMRC logs against |
|--------|-------------------------|
| Spreadsheet Tax live app | Sandbox app ID traffic from Railway |
| Postman | Same sandbox app if same client id/secret |

For Production approval, **prefer traffic from the real web app**. Postman is for **you** to learn and debug.

## Do not commit

- Exported environments containing secrets or test passwords  
- Screenshots with client secrets  

## Optional: Postman account

Create a free Postman account to sync collections to the cloud. **Not required.**  
If you want me to configure cloud sync later, we can do that without sharing the password in chat (you sign in on your machine).
