# SDSTeam email — **DO NOT SEND until SE + property + EOY probes are green**

Production application is **not** created until HMRC grants access.  
Re-run `npx playwright test tests/e2e/hmrc-mtd-full-journey.spec.js --config=playwright.prod.config.js` and check `docs/hmrc/sandbox-journey-run.json` first.

When (and only when) the in-year product is operational and sandbox logs exist under  
`e6751be5-fd22-4447-9e77-aa51729b1b46`:

---

Subject: Spreadsheet Tax — Production Approvals Checklist (In-Year) — sandbox testing complete

```
Hello SDSTeam,

Software name: Spreadsheet Tax
Developer: Lee Hine
Build type: In-Year product only (iterative — in-year stage)
Website: https://spreadsheet-tax-production.up.railway.app
Privacy: https://spreadsheet-tax-production.up.railway.app/privacy
Terms: https://spreadsheet-tax-production.up.railway.app/terms
Redirect URI: https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback

Sandbox application ID used for testing:
e6751be5-fd22-4447-9e77-aa51729b1b46

Production application: not yet created — please advise if you require Production app creation before or after checklist review for in-year APIs.

Please find attached the completed Production Approvals Checklist in the required form format.
Testing was performed via the software against the sandbox environment. Fraud prevention headers use connection method WEB_APP_VIA_SERVER with honest omission of unobtainable fields (including client public port on PaaS where the proxy does not expose it), per missing header data guidance.

We are not claiming HMRC-recognised status.

Kind regards,
Lee Hine
```

Attach: filled checklist `.docx` only (HMRC form).  
Optional: one-line note of periodIds if they ask — they primarily use **their logs**.
