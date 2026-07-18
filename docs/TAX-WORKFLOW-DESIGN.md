# Unified taxpayer workflow (SE + UK + foreign property)

**Implemented in product (1.18.0):** home, onboarding, records, cumulative quarterly review, nil update, guided year-end case, practice state catalog.  
**Capacity gate:** still separate — see CAPACITY-REQUIREMENTS.md (NOT MET for 800k).

## Product structure

| Nav | Route | Role |
|-----|-------|------|
| Home | `/home` | Next task, deadline, source readiness |
| Records | `/records` | Income sources / nicknames |
| Quarterly | `/app?flow=quarterly` | Upload → cumulative review → send |
| Tax return | `/year-end` | Guided EOY case |
| Messages | `/history` | Receipts / corrections entry |
| Settings | `/account` | Preferences |
| Practice | `/workspace` | Work queue |
| Internal | `/mtd` | Diagnostics only |

## Design rules (locked)

1. **One product** — not separate SE / landlord apps.  
2. **HMRC mirror only** — load businesses from HMRC; never create/replace HMRC income sources in-app. Missing business → HMRC then refresh. In-app help: `/guide`.  
3. **Visual boards** — `output/product-design/01–03*.png` + `docs/PRODUCT-BOARD-SPEC.md` are the UI map (with HMRC-mirror overrides).  
4. **Obligation-led** — HMRC businesses/obligations when connected; no manual business IDs as the primary path.  
5. **Quarterly path** — one income source at a time: choose source → upload period spreadsheet → map → check figures → send.  
6. **Per-source status and receipts** — submit results listed per source.  
7. **Nil path** — confirm zero activity without inventing figures.  
8. **Year-end** — adjustments after quarterly digital records; source checklist + guided stages, not API buttons first.  
9. **Practice / accountant** — separate shells; never bulk-bypass client approval.  

## APIs

- `GET/PUT /api/me/taxpayer-profile`  
- `GET/PUT /api/me/income-sources`  
- `POST /api/me/income-sources/from-hmrc`  
- `GET /api/me/dashboard`  
- `GET /api/me/drafts/:id/cumulative-review`  
- `POST /api/me/drafts/:id/snapshot`  
- `POST /api/me/nil-update`  
- `GET /api/practice/workflow-states`  

## Still to harden

- Full accountant four-eyes UI  
- Property-level multi-property maps inside one HMRC property business  
- FX rate capture UI (currently warns not to invent rates)  
- Corrections compare screen from history  
- Capacity 200×800k platform proof  
