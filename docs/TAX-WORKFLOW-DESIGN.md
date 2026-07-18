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
2. **Obligation-led** — HMRC businesses/obligations when connected; no manual business IDs as the primary path.  
3. **Cumulative YTD** — every quarterly review shows this period + previously recorded + year-to-date.  
4. **Per-source status and receipts** — multi-source packages still one upload; submit results listed per source.  
5. **Nil path** — confirm zero activity without inventing figures.  
6. **Year-end** — adjustments after quarterly digital records; guided case not API buttons first.  
7. **Practice** — approval states before submit; never bulk-bypass client approval.  

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
