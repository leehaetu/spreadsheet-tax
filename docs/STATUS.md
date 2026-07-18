# Project status

**Last updated:** 2026-07-18  
**App version:** **1.23.1**  
**Screen audit pack:** [docs/audits/2026-07-18-all-screens/](./audits/2026-07-18-all-screens/) — 51 screenshots + 52-page PDF with per-screen fixes  
**Protocol:** [AGENT-TRUTH-PROTOCOL.md](./AGENT-TRUTH-PROTOCOL.md)  
**Capacity gate:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) — **NOT MET**  
**Release gates:** [RELEASE-GATES.md](./RELEASE-GATES.md) — **OPEN**  
**Live:** https://spreadsheet-tax-production.up.railway.app  

---

## Truth status (2026-07-18) — v1.23 freeze + security foundations

```text
BLOCKERS:
- Capacity 200 practices / 800k customers NOT MET
- Release gates OPEN (tax review, DR restore, pen-test, full a11y, real billing)
- HMRC Recognised: No
- Individual vs agent OAuth separation: not fully proven as separate journeys
- Deployed sandbox re-run of ensure-property-businesses path: pending operator OAuth
- Card payments: NOT LIVE (no STRIPE_SECRET_KEY)
- Transactional email: stub unless EMAIL_WEBHOOK_URL
- CSRF enforced only when CSRF_ENFORCE=1 or NODE_ENV=production
- Practice admin MFA hard-require only when MFA_REQUIRE_PRACTICE_ADMIN=1

PROVEN:
- Unit tests: 198 planned; security-freeze suite pass [UNIT_TESTED]
- Product surface freeze inventory at GET /api/product-surfaces [ROUTE_ONLY + UNIT_TESTED]
- Billing select-plan returns 503 without Stripe [UNIT_TESTED]
- CSRF rejects authenticated mutations when CSRF_ENFORCE=1 [UNIT_TESTED]
- Login lockout after repeated failures [UNIT_TESTED]
- TOTP generate/verify [UNIT_TESTED]
- SE + UK + foreign period sandbox HTTP on prior journey ledger [SANDBOX_HTTP]
- Customer quarterly path exists (import → review → preview) [CUSTOMER_WORKFLOW / UNIT_TESTED]

UNPROVEN:
- Full unaided customer journey on production host after freeze
- 800k capacity load / isolation / recovery
- Independent pen-test and tax-domain sign-off
- Live Stripe checkout + webhook verification
- Real email delivery in production

EXTERNAL:
- HMRC Production credentials / recognition listing
```

### What shipped in 1.23.0 (code — not pilot-ready)

| Area | Change | Evidence tag |
|------|--------|--------------|
| Freeze | Product surface inventory; billing/mtd/admin/demo practice out of customer nav | `UNIT_TESTED` |
| Billing honesty | `/api/billing/select-plan` → 503 `BILLING_NOT_LIVE` without Stripe | `UNIT_TESTED` |
| CSRF | Token table + middleware; `GET /api/csrf` | `UNIT_TESTED` (when enforced) |
| Lockout | `login_failures` after failed passwords | `UNIT_TESTED` |
| MFA | TOTP enroll/confirm/disable; account UI | `UNIT_TESTED` (crypto) / UI `ROUTE_ONLY` |
| Session rotation | Destroy other sessions on login; after MFA/password change | `UNIT_TESTED` (password path prior) |
| Sandbox property | `POST /api/hmrc/mtd/ensure-property-businesses` — create fail ≠ success; list IDs | `ROUTE_ONLY` until sandbox re-run |
| Mode labels | site-chrome mode pill (preview / sandbox / live) | `CUSTOMER_WORKFLOW` (client) |
| Email | Still stub unless `EMAIL_WEBHOOK_URL`; never claims delivered when stub | `UNIT_TESTED` prior |

### Forbidden claims

- pilot-ready · production-ready · complete · marketable at scale · supports 200/800k · HMRC Recognised  

### Tests (this workstation)

- Unit: run `npm test` after change (CSRF_ENFORCE=0 for suite compatibility; `npm run test:security` enforces CSRF)  
- Deployed Playwright sandbox journey: re-run after deploy with live OAuth  

### Demo login (dev only)

`demo@spreadsheet-tax.example` / `DemoPass123!`

### Operator env (honest)

| Var | Effect |
|-----|--------|
| `CSRF_ENFORCE=1` | CSRF on authenticated API mutations |
| `MFA_REQUIRE_PRACTICE_ADMIN=1` | Policy flag for practice admins |
| `STRIPE_SECRET_KEY` | Enables paymentsLive (still need checkout + webhooks) |
| `EMAIL_WEBHOOK_URL` | Real email delivery |
| `HMRC_ALLOW_LIVE_SUBMIT=1` | External HMRC HTTP (still needs non-mock OAuth) |
