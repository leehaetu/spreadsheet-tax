# HMRC fraud headers + sandbox period submit (evidence)

**Date:** 2026-07-17  
**Environment:** HMRC **Sandbox** (`test-api.service.hmrc.gov.uk`)  
**App:** Spreadsheet Tax production Railway · `HMRC_OAUTH_MOCK=0` · `HMRC_ALLOW_LIVE_SUBMIT=1` (sandbox host only)

## Fraud prevention headers (FPH)

### How validated

Official HMRC API:

`GET https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate`  
(Application-restricted token)

Connection method: **`WEB_APP_VIA_SERVER`**

### Headers we send

| Header | Status |
|--------|--------|
| `Gov-Client-Connection-Method` | Sent · `WEB_APP_VIA_SERVER` |
| `Gov-Client-Device-ID` | Sent · UUID |
| `Gov-Client-Browser-JS-User-Agent` | Sent |
| `Gov-Client-Public-IP` | Sent |
| `Gov-Client-Public-IP-Timestamp` | Sent · ISO-8601 |
| `Gov-Client-Public-Port` | Sent · ephemeral (not 80/443) |
| `Gov-Client-Timezone` | Sent · `UTC±hh:mm` |
| `Gov-Client-Screens` | Sent · width/height/scaling/colour-depth |
| `Gov-Client-Window-Size` | Sent |
| `Gov-Client-User-IDs` | Sent · `spreadsheet-tax=<userId>` |
| `Gov-Vendor-Public-IP` | Sent |
| `Gov-Vendor-Forwarded` | Sent · `by=` vendor · `for=` client |
| `Gov-Vendor-Version` | Sent · `SpreadsheetTax=…` |
| `Gov-Vendor-Product-Name` | Sent · `SpreadsheetTax` |
| `Gov-Vendor-License-IDs` | Sent · SHA-256 of license key |
| `Gov-Client-Multi-Factor` | **Not sent** (password-only login) |

### HMRC validate result

```json
{
  "specVersion": "3.3",
  "code": "POTENTIALLY_INVALID_HEADERS",
  "message": "At least 1 header is potentially invalid",
  "warnings": [
    {
      "code": "MISSING_HEADER",
      "headers": ["gov-client-multi-factor"],
      "message": "…may be correct for single factor authentication, for example username and password. If this is the case, you must contact us explaining why you cannot submit this header."
    }
  ]
}
```

- **Errors:** none  
- **Warnings only:** multi-factor (expected for username/password web login)  
- **Not** `VALID_HEADERS` solely because MFA header is absent — HMRC’s own message says this can be correct for single-factor auth; production approval needs a short note to SDSTeam@hmrc.gov.uk if MFA is not used.

Earlier fixes that cleared **errors**:

- Do not send public port `443` / `80`  
- Always send screens with scaling-factor + colour-depth  
- Always send timezone  
- Send vendor-forwarded + public-ip timestamps  

## Real sandbox period submit (SE)

| Field | Value |
|-------|--------|
| Host | `https://test-api.service.hmrc.gov.uk` |
| Method | `POST` |
| Path | `/individuals/business/self-employment/TB116925D/XBIS12345678901/period` |
| Accept | `application/vnd.hmrc.5.0+json` |
| Auth | User OAuth Bearer (non-mock) |
| HTTP | **200** |
| HMRC body | `{"periodId":"2024-04-06_2024-07-05"}` |
| `externalCallMade` | **true** |
| `mode` | **sandbox** |

Business ID came from real **Business Details (MTD)** list call:

```json
{"typeOfBusiness":"self-employment","businessId":"XBIS12345678901","tradingName":"Company X"}
```

Draft figures came from real import pipeline (`/api/import/sample` self_employment), not a hand-built fake HMRC body.

## What this is / is not

| Claim | True? |
|-------|--------|
| Real HMRC **sandbox** HTTP | **Yes** |
| Real OAuth user token | **Yes** |
| Real FPH validate API | **Yes** |
| Production (live taxpayer) HMRC | **No** — sandbox host only |
| Full `VALID_HEADERS` with MFA | **No** — password-only → MFA warning only |

## Operator note for HMRC production approval

Email SDSTeam / use Hub support to confirm single-factor web login (no MFA header) for Spreadsheet Tax, referencing the validate warning text.
