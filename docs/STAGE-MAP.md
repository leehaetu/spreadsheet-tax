# Spreadsheet Tax — stage map

**Last updated:** 2026-07-17  
**Live:** https://spreadsheet-tax-production.up.railway.app  
**Product only:** Spreadsheet Tax (ignore any other product names for planning)

## Honest stage

| # | Stage | Status |
|---|--------|--------|
| 1 | Build product | **Done enough to pilot** |
| 2 | Sandbox HMRC integration | **In progress — make fully operational for in-year SE/property** |
| 3 | Sandbox testing complete + Production Approvals Checklist | **Not ready to send** until software is operational + logs exist |
| 4 | Create Production Hub app + HMRC review | **Do not start** until stage 3 is real |
| 5 | HMRC-recognised / live taxpayer filing | **Later** |

**Sandbox application ID (Hub):** `e6751be5-fd22-4447-9e77-aa51729b1b46`  
**Production application:** **not applied for** — correct. Nowhere near ready.

---

## How HMRC actually gate Production (learned process)

They are bureaucratic. Online Hub form ≠ finished job.

| What they do | What that means for us |
|--------------|-------------------------|
| You create/subscribe apps on Developer Hub | Credentials + API list |
| You test in **sandbox through your software** | Calls must hit `test-api.service.hmrc.gov.uk` from the product |
| You complete **Production Approvals Checklist** (their Word form, their format) | **This is the document they want returned** |
| SDSTeam reviews **checklist + their sandbox logs + fraud headers** | They check **API calls in their systems**, not a pretty “pack” as the official gate |
| Optional JSON/notes we write | **Internal** — helps you remember IDs/periodIds; **not** a substitute for the checklist or logs |
| Up to ~10 working days (often longer in MTD rush) | Each incomplete bounce restarts the queue |

**Why fill online then wait 12 days then get the checklist?**  
Hub “apply / message / interest” and **Production Approvals Checklist** are separate steps in their process. Annoying and wasteful of your time — but expected. **This time:** do not email SDSTeam for Production until the **in-year product is operational** and sandbox logs show the journey end-to-end.

**FPH / API questions with no reply:** common under high volume. Keep testing in sandbox + document omissions honestly (public port). Don’t wait for SDSTeam to design your product.

---

## “Full operational software” (what we aim for before any Production ask)

For **in-year product** (quarterly updates — not full EOY yet):

Must work as real software (not demo-only):

1. Sign up / sign in  
2. Connect HMRC sandbox OAuth  
3. List businesses (Business Details)  
4. Load obligations  
5. Import spreadsheet → review → server draft  
6. Submit SE / UK property / foreign property period (sandbox HTTP)  
7. Errors shown clearly  
8. Fraud headers on every MTD call (honest omit)  
9. Customer can export / own records path  
10. Tax estimate: signpost HMRC **or** Calculations API  
11. Non-mandated + EOY not supported: stated + GOV.UK software list link  
12. **Not** marketed as HMRC-recognised until recognition  

We are **building toward** that. We are **not** ready to apply for Production.

---

## Roadmap note (planning only)

Source: [MTD ITSA vendor API roadmap](https://developer.service.hmrc.gov.uk/roadmaps/mtd-itsa-vendors-roadmap/documentation/apis.html)

**March 2026 already-deployed items that affect us:**

| Change | Why it matters |
|--------|----------------|
| Obligations due dates align to 7th of month (26-27+) | UI copy / obligation display |
| Foreign property multi-property-same-country (Property 6.0 / BSAS / Calculations) | Property mapping + period payloads |
| Transition profit fields on Calculations | Only if we show calcs in-app |

**Later 2026–27:** Class 4 NI adjustment on SE annuals, penalties on Accounts API, capital gains/EOY-heavy work — **not** first Production gate if we stay **in-year only**.

Changelog for deployed detail: [income-tax-mtd-changelog](https://github.com/hmrc/income-tax-mtd-changelog).

---

## What to send HMRC (when ready — not now)

1. **Software-Approvals-Production-Checklist** completed in **their format**  
2. Email SDSTeam: sandbox application ID + that testing is complete  
3. They pull **logs** for that sandbox app  
4. Fraud header review  

**Do not** send Production request yet.  
**Do not** create Production app until operational sandbox journey is proven.

---

## Immediate build direction

1. Full in-year operational path (SE + property + obligations + businesses + honest UX)  
2. Generate real sandbox API log traffic under app `e6751be5-fd22-4447-9e77-aa51729b1b46`  
3. Harden FPH (honest)  
4. Only then fill checklist + email once  
