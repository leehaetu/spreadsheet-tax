# Full-repo truth audit

**Date:** 2026-07-17  
**Purpose:** Record every known lie, overclaim, or misleading behaviour found in this product/repo, and the fix status.  
**Rule:** Prefer incomplete truth over complete fiction.

---

## Confirmed false or misleading (history)

| # | Issue | What was wrong | Status |
|---|--------|----------------|--------|
| T1 | **`Gov-Client-Public-Port` invented** | Code hashed device id → fake high port (e.g. 59637) so HMRC FPH validate would not fail | **FIXED** — port only if real proxy/client value; otherwise **omitted** |
| T2 | **Default fake screens / timezone** | Sent 1920×1080 and UTC+00:00 when browser sent nothing | **FIXED** — only client-reported values |
| T3 | **Vendor IP = client IP** | When `VENDOR_PUBLIC_IP` unset, used client IP as vendor IP | **FIXED** — omit vendor IP unless env set |
| T4 | **FPH “passed” framing** | Implying full VALID_HEADERS when HMRC returned `POTENTIALLY_INVALID_HEADERS` (MFA warning) and earlier ERRORS were papered over with invention | **CORRECTED** — report exact HMRC code; no inventing to get green |
| T5 | **Submit “success” without context** | Earlier UI said “accepted” on double/preview | **FIXED earlier** — preview says NOT sent to HMRC |
| T6 | **Mock OAuth as Connected** | Mock tokens looked like HMRC connect | **FIXED earlier** — `connected: false` when mock |
| T7 | **Demo portfolio as real practice** | `/accountant` `/practice` in-memory fiction | **LABELLED** — still exists; marked fictional |
| T8 | **Illustrative quotes as reviews** | Sales “what people say” | **FIXED earlier** — marked illustrative / not reviews |
| T9 | **Sandbox submit figures presented without source** | Real HMRC 200 used **fixture** CSV + sandbox NINO/business, not a customer file | **DOCUMENTED** — must always state source |
| T10 | **STATUS.md outdated blockers** | Still said “need Hub Client ID” after credentials existed | **FIXED this audit** |
| T11 | **Plan flag `liveHmrc: true`** | Entitlements imply live HMRC path from plan alone; server still gates submit | **FIXED this audit** — renamed/clarified to capability, not entitlement |
| T12 | **Agent readiness overclaim (2026-07-18)** | Status sold as strong progress toward full operational / HMRC path; treated route matrix + partial sandbox as product completion; journey “okish” counted non-2xx as success; customer app presented as usable while HTML/JS review IDs mismatched (`review-panel` vs `preview-panel`) | **ACKNOWLEDGED** — not fixed as product; control added: `docs/AGENT-TRUTH-PROTOCOL.md`, template, AGENTS.md bind. Stage reset to **2 of 5**. |
| T13 | **Broken primary app journey after UX redesign** | HTML redesigned; JS still targets old element IDs — sample/import does not show review | **OPEN P0** — Gate 0 |
| T14 | **Draft submit without ownership check** | `getDraft(id)` on submit/MTD without proving session user/firm owns draft | **OPEN P0** |
| T15 | **Cross-tenant deadline reminders** | Any firm member can run job; query is all clients | **OPEN P0** |
| T16 | **Roles not enforced server-side** | Membership treated as enough for invites/admin-ish actions | **OPEN P0** |
| T17 | **Insecure production defaults** | Token encrypt fallback to SESSION_SECRET or hardcoded dev key; Secure cookie optional | **OPEN P0** |
| T18 | **Vulnerable xlsx parser** | `xlsx@0.18.5` high severity; no upstream fix on package | **OPEN P0** (replace/isolate/risk-accept with controls) |
| T19 | **Journey scorer honesty** | Steps with HMRC non-2xx marked `ok: true` / okish inflated | **OPEN** — scorer + reporting must use true HMRC status |

---

## Still true limitations (not lies if stated)

| Item | Truth |
|------|--------|
| Default public submit | **Preview/double** unless `HMRC_ALLOW_LIVE_SUBMIT=1` + real OAuth |
| Production (live) HMRC filing | **Not enabled** for real taxpayers; sandbox only when submit flag on |
| Billing | Plan row only — **no card charge** |
| Email | Stub/log unless `EMAIL_WEBHOOK_URL` |
| Demo practice APIs | Fictional in-memory data |
| Sample spreadsheets | Fixtures under `test-spreadsheets/` and `fixtures/` |
| Demo login | Seeded account for product testing |
| Token encryption key fallback | Dev fallback string if secrets unset — **unsafe for production** if secrets missing |
| FPH completeness | Many headers omitted when unobtainable; not “full pack validated green” |
| UK/foreign property sandbox submit | Code paths shipped (1.10.0); **HTTP 200 not claimed** until operator runs with OAuth + draft |
| HMRC Production API credentials | Not granted — sandbox only until Hub Production approval |
| In-software tax liability estimate | Not implemented — signpost to HMRC online account (honest for in-year product) |

---

## What was verified as real (sandbox)

| Claim | Evidence type |
|--------|----------------|
| Client credentials token | Direct HTTPS to `test-api.service.hmrc.gov.uk/oauth/token` |
| Hello World / Application | Direct HTTPS 200 |
| Create Test User | Unique HMRC-generated identity |
| User OAuth | Playwright to `test-www.tax.service.gov.uk` → grant → `connected: true`, `mock: false` |
| Business Details list | Sandbox 200, businessId `XBIS12345678901` |
| SE period POST | Sandbox 200, `periodId: 2024-04-06_2024-07-05` from fixture import |

---

## Permanent rules (builders)

See `AGENTS.md` § Truth-first and **`docs/AGENT-TRUTH-PROTOCOL.md`** (anti-overclaim, evidence tags, status template, consequences).  
Code: `src/lib/fraud-headers.js` honesty rule. Tests: `tests/hmrc-oauth-fraud.test.js` asserts no invented port.

---

## Audit method

- Grep for synthetic/invent/fake/placeholder/defaults  
- Read FPH builder, OAuth, submit, entitlements, STATUS, integrity  
- Cross-check docs vs live env  
- No claim of “full clean” beyond items listed  

**If new falsehood is found later, add a row here. Do not delete history.**
