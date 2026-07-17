# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Version:** 1.6.0

## Honesty (HMRC-inspectable)

| Layer | Reality |
|-------|---------|
| Spreadsheet → map → validate → draft | **Real** |
| Public submit | **Preview only** (not HMRC) until live flag + real OAuth |
| Mock OAuth | Labelled mock; `connected: false` |
| Demo `/accountant` `/practice` | **Fictional** in-memory data |
| Authenticated `/workspace` | **Real** SQLite firm book |
| Integrity | `/integrity` · `/api/integrity` · `docs/HONESTY-FOR-HMRC.md` |

## Tests

**91** unit tests passing (includes honesty gates).

## Demo login (labelled demo)

`demo@spreadsheet-tax.example` / `DemoPass123!`

## External remaining (not claimed complete)

HMRC Developer Hub credentials, real OAuth, fraud-header pack validation, production approval, card billing, real email, pen-test, legal pack.
