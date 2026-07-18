# Product board specification (locked)

**Owner:** Lee Hine  
**Boards (visual source of truth):**

| Board | File |
|-------|------|
| Setup & income sources | `output/product-design/01-setup-and-income-sources.png` |
| Quarterly update workflow | `output/product-design/02-quarterly-update-workflow.png` |
| Year-end, history & errors | `output/product-design/03-year-end-history-and-errors.png` |

These boards define **layout, hierarchy, chrome, and interaction structure**.  
They do **not** override hard product rules below when the board illustration conflicts with bridging software constraints.

---

## Hard product rules (override the boards where they conflict)

1. **HMRC mirror only** — Spreadsheet Tax does **not** create, replace, add, or delete HMRC businesses/income sources. It only **loads and displays** businesses returned by HMRC APIs.
2. **Missing business** — User adds or changes the business **in HMRC**, then **refreshes** the list here. In-app Help explains this; sales site is separate.
3. **Bridging, not books** — Primary digital link is the **uploaded spreadsheet**. No inventing tax calculations or “new business” bookkeeping inside the product.
4. **One HMRC income source per quarterly submission** — Workflow selects one mirrored source, then upload → check → send for that source.
5. **Customer UI is production-shaped** — Do not present the product as sandbox/demo/practice to customers. Operator/sandbox tools stay on internal routes (`/mtd`, advanced connect tools). Connection chrome: **Connected** / **Not connected**.
6. **Evidence ladder still applies** — UI fidelity ≠ production-ready. Sandbox-capable behaviour is wired; live claims need evidence.

---

## Board 1 → screens (adapted)

| Board frame | App screen | Implementation rule |
|-------------|------------|---------------------|
| 1 Sign in | `/signin` | Card + security copy; **no** live product nav chrome |
| 2 Welcome | `/onboarding` step 1 | Welcome + NINO + Connect HMRC (not Preview vs Live marketing) |
| 3 Choose sources | `/onboarding` step 2 | **Confirm sources loaded from HMRC** — not “tick types to create” |
| 4–6 Add SE / UK / foreign | `/onboarding` step 3 | **Display-name / local labels only** for HMRC-returned businesses — never create HMRC entities |
| (help) | `/guide` | How to add a business **with HMRC**, then refresh |

---

## Board 2 → screens

| Board frame | App screen | Notes |
|-------------|------------|-------|
| 1 Tax home | `/home` | Next task, income sources list, tax year |
| 2 Choose income source | `/app?flow=quarterly` step sources | One source at a time |
| 3 Add records | `/app` step upload | Spreadsheet upload + download template (no create business) |
| 4 Map columns | `/app` step map | Discrete step after import |
| 5 Review figures | `/app` step review | Totals for this update / selected source |
| 6 Declare and submit | `/app` step submit | Declaration + send; IDs from HMRC link, not manual primary form |

---

## Board 3 → screens

| Board frame | App screen | Notes |
|-------------|------------|-------|
| 1 Year-end overview | `/year-end` | Checklist by mirrored income source |
| 2–4 Adjustments | `/year-end` stages | SE / UK / foreign forms when relevant |
| 5 Summary | `/year-end` | Totals when calculation path available |
| 6 Final declaration | `/year-end` | Declaration gate |
| 7 Submission history | `/history` | Timeline + receipts |
| 8 Error states | Dialogs / recovery cards | Auth expired, validation, duplicate, etc. |

---

## Implementation status (honest)

| Area | Status |
|------|--------|
| Shared product shell (nav, icons, width) | **In app** — `product-shell.js` injects nav on all product pages |
| Sign-in | **In app** — branded panel, no product nav chrome |
| Onboarding HMRC-mirror | **In app** — welcome → load/confirm HMRC sources → names → review |
| Quarterly step cards | **In app** — source → upload → map → figures → send |
| Year-end checklist by source | **In app** — source board + guided stages; workflow registry wired |
| In-app Help (`/guide`) | **In app** — HMRC businesses, quarterly, year-end |
| Connect HMRC | **In app** — product shell; operator tools hidden by default |
| Pixel-perfect board art match | **Not claimed** — structure matches boards; polish continues |
| Sandbox HTTP E2E for every interaction | **Not complete** — APIs exist; not every control has SANDBOX_HTTP evidence |

Update this table when a board frame is fully wired with browser evidence.

---

## Related

- `docs/TAX-WORKFLOW-DESIGN.md` — product structure  
- `docs/DECISIONS/0011-cumulative-updates.md` — period vs YTD  
- `docs/AGENT-TRUTH-PROTOCOL.md` — no overclaim  
