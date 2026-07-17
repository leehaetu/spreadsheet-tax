# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Version:** 1.7.0

## This slice (move on)

| Item | Status |
|------|--------|
| Expanded fraud-prevention headers (WEB_APP_VIA_SERVER) | Device ID, timezone, screens, window, user ids |
| Browser sends client metadata on API calls | `public/js/app.js` |
| Sales/pro CTAs → real `/workspace` | Demo portfolio demoted |
| Email honesty | `delivered` flag; webhook optional |
| Integrity API updated | fraud keys + email mode |

## Honesty

Preview submit default · mock OAuth labelled · demo portfolio fictional · integrity at `/integrity`

## External blockers (need Lee)

1. HMRC Developer Hub Client ID / Secret  
2. `HMRC_OAUTH_MOCK=0` + redirect URI  
3. Sandbox submit test with real token  
4. Optional: `EMAIL_WEBHOOK_URL`, `VENDOR_PUBLIC_IP`

## Demo

`demo@spreadsheet-tax.example` / `DemoPass123!`
