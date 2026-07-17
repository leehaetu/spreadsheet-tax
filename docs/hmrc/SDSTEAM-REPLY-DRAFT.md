# Draft reply to SDSTeam (Jacob Barker / Production checklist)

**Do not send until you paste Hub Sandbox ID + Production Application ID.**  
**Reference context:** earlier ticket **2026-EPI962** was about **QuarterLink**. This reply is for **Spreadsheet Tax**.

---

Subject: Spreadsheet Tax — Production Approvals Checklist (In-Year) + sandbox testing details

```
Hello Jacob / SDSTeam,

Thank you for the Production Approvals Checklist and the requirements summary.

Product name for this request: Spreadsheet Tax
(Previous correspondence and June 2026 sandbox pack under product name QuarterLink / reference 2026-EPI962 — please treat Spreadsheet Tax as the current application name and live URLs below. Advise if you need a new Production application rather than reusing the existing one.)

Company / developer: Lee Hine
Live URL: https://spreadsheet-tax-production.up.railway.app
Privacy: https://spreadsheet-tax-production.up.railway.app/privacy
Terms: https://spreadsheet-tax-production.up.railway.app/terms
Redirect URI: https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback
Integrity: https://spreadsheet-tax-production.up.railway.app/api/integrity

Build type: In-Year product only (iterative). Stage: In-Year quarterly bridging.
Income sources: Self-employment, UK property, Foreign property.
Customer base this stage: Individuals (not agents).
HMRC-recognised claim: No — not claimed until recognition is granted.

Sandbox application ID: [PASTE FROM HUB]
Production application ID: [PASTE FROM HUB]

Attached:
1) Completed Production Approvals Checklist (Spreadsheet-Tax-Production-Approvals-Checklist-FILLED.docx)
2) spreadsheet-tax-sandbox-evidence-pack.json

Testing summary (via software, not submission-tool-only):
- Client credentials + Hello World / Hello Application
- Create Test User
- User-restricted OAuth grant (sandbox)
- Business Details list
- Obligations (income & expenditure)
- Self Employment period summary create (sandbox HTTP 200; fixture spreadsheet)
- Property Business period paths implemented (UK + foreign)
- Fraud prevention headers WEB_APP_VIA_SERVER with honest omission of unobtainable fields

Fraud prevention — missing data (not invented):
- Gov-Client-Public-Port: omitted when PaaS proxy does not expose client public TCP port (per missing header data guidance)
- Multi-Factor: omitted (password-only auth)
- Vendor public IP configured via environment (Railway egress)

Tax calculation: not displayed in software; customers are signposted to their HMRC online account.
End-of-year / final declaration / losses / BSAS: not in this stage; clearly stated with link to HMRC compatible software list.

Please review for Production access to the In-Year APIs for Spreadsheet Tax.
I will avoid follow-up progress chasers and wait for your review.

Kind regards,
Lee Hine
```

---

## Truth notes for you (Lee)

1. HMRC delays and “wait up to 10 working days / high MTD volume” are real — not something the code can fix.  
2. Sending incomplete packs causes full re-review delay — fill **Sandbox ID** and **Production App ID** before send.  
3. Do **not** paste live Production secrets into email body.  
4. Do **not** claim recognised.  
5. The checklist file HMRC attaches is the same form as `Software-Approvals-Production-Checklist-2026-06-15.docx` in Downloads (not a new form at 10pm unless they send another).  
6. Filled copy is on **Desktop** and **Downloads**: `Spreadsheet-Tax-Production-Approvals-Checklist-FILLED.docx`
