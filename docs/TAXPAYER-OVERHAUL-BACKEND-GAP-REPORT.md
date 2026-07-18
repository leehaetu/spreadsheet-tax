# Taxpayer overhaul — backend and HMRC wiring report

Last updated: 18 July 2026

This is a living implementation report for the approved taxpayer workflow boards in `output/product-design/`. It distinguishes visible UI, local persistence, preview/test-double behaviour, real HMRC sandbox HTTP, and production approval. A visible control is not evidence of HMRC support.

## Evidence labels

- `UI_WIRED`: customer interaction is implemented and calls a named application route.
- `LOCAL_PERSISTENCE`: saved in the application database but not sent to HMRC.
- `PREVIEW_DOUBLE`: produces an internal preview/receipt without HMRC HTTP.
- `SANDBOX_HTTP`: an executed test has proved an HMRC sandbox request.
- `PRODUCTION_UNPROVEN`: production access, approval or end-to-end production evidence is absent.

## Current mapping

| Customer operation | Application support | HMRC/backend position | Current gap or required fix |
|---|---|---|---|
| Sign in and protected taxpayer routes | Existing session authentication and route gates | Application-only | Full security/release gates remain separate from UI completion. |
| Choose self-employment, UK property and multiple foreign-property sources | `PUT /api/me/income-sources` (`UI_WIRED`, `LOCAL_PERSISTENCE`) | Can optionally import HMRC business list through `POST /api/me/income-sources/from-hmrc` | Source detail fields beyond type/business ID/country/joint share are stored in taxpayer profile metadata, not a dedicated normalised table. |
| Foreign-property country, currency and exchange-rate method | Setup UI and taxpayer profile metadata (`UI_WIRED`, `LOCAL_PERSISTENCE`) | Country code is used by deterministic foreign-property mapping | Currency conversion is not performed by this setup UI. Uploaded figures must already be GBP; evidence capture for the chosen rate is not yet a dedicated backend record. |
| Quarterly spreadsheet/CSV import | `POST /api/import`; saved drafts; deterministic mapping and validation | Period payload builders exist for SE, UK property and foreign property | The approved board's source-first workflow is now visible, but import currently remains capable of combined-source files rather than enforcing one selected source. |
| Manual quarterly entry | Manual rows are converted to the shipped `section,field,value,country` CSV format, then sent through `POST /api/import` (`CUSTOMER_WORKFLOW`) | Uses the same deterministic mapping and validation as uploaded spreadsheets | This is totals entry, not a full transaction ledger. Customer must still review mapped figures. |
| Column mapping and cell review | Existing spreadsheet review model, cell comments and approval lock | Used before submission | Presented inside the review page rather than a fully separate route. Browser journey verification still required. |
| Quarterly declaration and submission | Existing draft approval and submit routes; receipts and evidence packs | HMRC adapters exist for all three source types | Production HTTP remains env/approval gated. Exact sandbox evidence must be re-run after the overhaul. |
| Nil update | `POST /api/me/nil-update` | Builds a zero-activity payload | Customer source selection must be verified to pass the intended source/country consistently. |
| Self-employment annual adjustments | `POST /api/workflows/run` with `se_annual` and explicit body (`UI_WIRED`) | HMRC annual adapter exists | Preview mode exits before validating the business ID/body, so a preview receipt does not prove HMRC payload validity. |
| UK-property annual adjustments | `POST /api/workflows/run` with `uk_annual` and explicit body (`UI_WIRED`) | HMRC annual adapter exists | Finance-cost and every possible annual field are not yet represented in the customer form; official schema coverage needs a field-by-field audit. |
| Multiple foreign-property annual adjustments | `POST /api/workflows/run` with one `foreignProperty[]` entry per configured country (`UI_WIRED`); adjustment/evidence drafts persist by tax year and stage | Foreign-property annual adapter exists | The application holds a single foreign business ID field. Confirm against real HMRC business discovery whether all configured countries belong under that business for the customer; do not assume. Foreign tax/rate evidence is deliberately not inserted into an unverified annual schema field. |
| Losses and other income | `losses` and `other_income` workflows exist | HMRC adapters exist | Customer form currently covers brought-forward SE loss only. Other-income adjustment needs a complete customer form and official validation rules. |
| HMRC calculation | `calc`, `calc_list`, `final_calc` workflows; UI extracts and labels numeric HMRC response values only | HMRC calculation adapters exist | Preview correctly shows no estimate. Rendering against a real current sandbox calculation response remains unverified. |
| Final declaration | Confirmation UI calls `final_calc` | Current code models this as an intent-to-finalise calculation request | Confirm the exact HMRC final-declaration journey and declaration wording against the current official API; the existing route name does not by itself prove final declaration completion. |
| Submission history and evidence | `GET /api/me/submissions`, receipt and evidence endpoints | Stores mode/status/response | Needs visual overhaul, status filtering and browser verification. |
| Expired authorisation, HMRC outage and duplicate prevention | Recovery guidance, unsaved-change dialog and source-removal dialog exist; submission-integrity checks exist | HMRC HTTP status/error codes are returned on relevant paths | Expired-token and service-status cards still need to be driven directly from their backend status responses. No error may be shown as success. |
| Production HMRC access | Environment-gated and human-approval constrained | `PRODUCTION_UNPROVEN` | Requires HMRC production credentials/approval, recognised-software status when actually obtained, and executed production-like acceptance evidence. |

## Known release blockers independent of this UI overhaul

- Capacity acceptance for 200 practices and 800,000 customers is not proven.
- The full release-gate set in `docs/RELEASE-GATES.md` remains authoritative.
- HMRC recognised-software status must not be displayed until listing is real.
- Production deployment and live submission require human approval.

## Shipped UI wave (v1.27) — evidence tags

| Surface | Tag | Note |
|---|---|---|
| Multi-step `/onboarding` (SE + UK + multi foreign) | `UI_WIRED` + `LOCAL_PERSISTENCE` + `UNIT_TESTED` | Saves profile + income sources |
| Quarterly source picker on `/app` | `UI_WIRED` + `UNIT_TESTED` | Source selection stored in sessionStorage; import still allows combined files |
| Year-end adjustment forms + declaration gate | `UI_WIRED` + `PREVIEW_DOUBLE` | Payload fields posted into existing workflows; not production HMRC proof |
| History filter / recovery cards | `UI_WIRED` + `LOCAL_PERSISTENCE` | Uses drafts + submissions APIs |
| Playwright e2e (`tests/e2e/taxpayer-overhaul.spec.js`) | `CUSTOMER_WORKFLOW` when green | Browser path for setup → quarterly + year-end chips + history |

## Still incomplete after this wave

| Gap | Why it remains |
|---|---|
| Currency conversion engine | Setup stores method only; figures must already be GBP |
| Full HMRC annual field matrix | Customer forms cover a subset of allowances/adjustments |
| Final declaration official journey wording | `final_calc` is intent-to-finalise; not production declaration proof |
| Capacity 200×800k | Platform gate separate |
| HMRC Recognised / Production access | External |
| Independent tax review / pen-test | External |

This report must be expanded as each remaining screen is wired and tested. It must not be used as a readiness claim.
