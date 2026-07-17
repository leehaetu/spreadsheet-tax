# Project status

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Truth audit:** [TRUTH-AUDIT.md](./TRUTH-AUDIT.md)

## Current truth (do not soften)

| Fact | Value |
|------|--------|
| OAuth mock | **Off** (`HMRC_OAUTH_MOCK=0`) |
| Hub credentials | **Set** on Railway (sandbox app) |
| Default public submit | **Preview/double** unless live flag + real token |
| Sandbox SE period submit | **Done once** (fixture plumber CSV → 200 + periodId) — not customer books |
| FPH | **Honest omit** policy after invent-port incident; not full VALID_HEADERS |
| Billing | Stub — no cards |
| Email | Stub unless webhook |
| Demo portfolio | Fictional, labelled |

## Version

See live `/health` for deployed version.

## Demo product login

`demo@spreadsheet-tax.example` / `DemoPass123!`

## Operator next (truthful)

1. Set `VENDOR_PUBLIC_IP` to real Railway egress IP if known  
2. Document MFA omission to HMRC for production approval  
3. Property sandbox submits only if explicitly required  
4. Do not claim production live filing  

## Honesty rule for agents

**Truth first.** See `AGENTS.md` and `docs/TRUTH-AUDIT.md`. Never invent FPH or outcomes.
