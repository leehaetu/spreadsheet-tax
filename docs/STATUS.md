# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  

## This slice (continue plan)

| Item | Status |
|------|--------|
| Railway **volume** `/app/data` (5GB) | **Ready** — SQLite persists across redeploys |
| `DATA_DIR=/app/data` | Set on production |
| App env secrets (session, token key, mock OAuth) | Set |
| Audience modes `?mode=self-employed` / `property` | Shipped |
| Workspace **import file for client** | Shipped |
| Professional CTAs → `/workspace` | Shipped |
| GitHub push + Railway deploy | `b12ef16` |

## Tests

- Unit: 68 pass  
- E2E: 17 pass  

## Demo login

`demo@spreadsheet-tax.example` / `DemoPass123!`

## Still not production launch

Real HMRC Hub credentials, card billing, pen-test, legal pack, interviews.
