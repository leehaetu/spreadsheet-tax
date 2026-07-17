# Spreadsheet Tax — stage map (keep updated)

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  

## Stages

| # | Stage | Status |
|---|--------|--------|
| 1 | Build product (app, auth, import, drafts, Railway) | **DONE** |
| 2 | Sandbox HMRC (OAuth, SE/Property/BD/Obligations, FPH honest) | **DONE for core** — property HTTP 200 optional re-run |
| 3 | Evidence pack + Production Approvals Checklist ready | **DONE as pack** — Lee pastes Hub IDs + emails SDSTeam |
| 4 | HMRC Production credentials + recognition | **WAITING ON HMRC** after send |
| 5 | Live recognised filing / customers | **CLOSED** until stage 4 |

## Path A (HMRC) — now

- Filled checklist: `docs/hmrc/Spreadsheet-Tax-Production-Approvals-Checklist-FILLED.docx`  
- Evidence JSON: `docs/hmrc/spreadsheet-tax-sandbox-evidence-pack.json`  
- Reply draft: `docs/hmrc/SDSTEAM-REPLY-DRAFT.md`  
- **Your action:** paste Sandbox + Production app IDs → send email once  

## Path B (product) — now

- In-year scope panel on `/app` (non-mandated + EOY divert + tax signpost + export)  
- Security scope section  
- Site-wide **Not HMRC-recognised**  
- History export for submission records  

## QuarterLink vs Spreadsheet Tax

| Item | QuarterLink (old) | Spreadsheet Tax (current) |
|------|-------------------|---------------------------|
| June 2026 SDSTeam pack | Yes | No (different product name) |
| EPI962 | Yes | Separate — name Spreadsheet Tax in new mail |
| Live Railway product | Legacy / backup | **This** repo + URL |

## Next after HMRC reply

- If approved: store Production secrets on Railway only; keep `HMRC_OAUTH_ENV=sandbox` until go-live decision  
- If gaps: fix only what they list, re-test, resend **one** complete pack  
