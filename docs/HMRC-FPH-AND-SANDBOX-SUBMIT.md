# HMRC fraud headers + sandbox period submit

**Honesty correction (2026-07-17):** An earlier revision **invented** `Gov-Client-Public-Port` (hash of device id → high port) and defaulted screens/timezone when missing. That was wrong. It has been **removed**. We only send FPH values with a real source, or we omit them.

## Rule

> Never invent FPH fields. Prefer incomplete-but-true over complete-but-false.

HMRC: [missing header data](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/getting-it-right/#missing-header-data).

## Gov-Client-Public-Port

| Source | Used? |
|--------|--------|
| Invented / synthetic | **No (removed)** |
| Browser JS | **Cannot** observe public TCP port |
| `X-Client-Public-Port` / `X-Forwarded-Port` | Only if present and not 80/443 |
| Otherwise | **Omitted** |

## What we can source honestly

| Header | Source |
|--------|--------|
| Connection-Method | Constant `WEB_APP_VIA_SERVER` |
| Browser-JS-User-Agent | Request `User-Agent` |
| Device-ID | Client `localStorage` UUID via `X-Client-Device-Id` only |
| Public-IP + timestamp | `X-Forwarded-For` / `X-Real-IP` / socket |
| Public-Port | Only real proxy/client-reported port |
| Timezone / screens / window | Client JS only |
| User-IDs | Signed-in user id |
| Multi-Factor | Only if MFA actually used (password-only → omit) |
| Vendor-Public-IP | Env `VENDOR_PUBLIC_IP` only (not client IP copy) |
| Vendor-Forwarded | Only when both client + vendor IPs known |
| Vendor-Version / Product-Name / License-IDs | Product identity |

## Sandbox period submit (real HMRC sandbox HTTP)

| Field | Value |
|--------|--------|
| Period | **2024-04-06 → 2024-07-05** (tax year 2024-25 first quarter dates) |
| Spreadsheet | **Fixture** `test-spreadsheets/01-self-employment-plumber.csv` via `POST /api/import/sample` `{sample:"self_employment"}` — not a customer file |
| NINO | Sandbox test user `TB116925D` |
| Business ID | From Business Details API `XBIS12345678901` |
| Result | HTTP **200**, `periodId: 2024-04-06_2024-07-05` |

## Production approval note

Document to HMRC SDSTeam:

1. Web app cannot collect client public TCP port in pure browser TLS  
2. Password-only auth → no Multi-Factor header  
3. Vendor public IP configured via `VENDOR_PUBLIC_IP` when known  
