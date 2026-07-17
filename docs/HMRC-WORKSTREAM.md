# HMRC workstream

**Status:** Operational checklist (truthful as of 2026-07-17)  
**Accountable:** Lee Hine  
**Linked:** [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md) · [HMRC-PRODUCTION-ACCESS.md](./HMRC-PRODUCTION-ACCESS.md) · [TRUTH-AUDIT.md](./TRUTH-AUDIT.md)

Production access has lead times **outside the repo**. Code alone cannot flip H3.

---

## 1. Registration and credentials

| ID | Work | Owner | Status | Evidence |
|----|------|-------|--------|----------|
| H1 | Developer Hub Sandbox application registered | Lee | **done** | Hub app + subscriptions |
| H2 | Sandbox client id/secret secured | Lee | **done** | Railway env (not git) |
| H3 | Production application / approval | Lee | **not_started** | Needs Hub Production app + SDSTeam checklist |
| H4 | Redirect URIs documented | Lee | **done** | Live callback registered |
| H5 | Scope matrix documented | Lee | **done** | `write:self-assessment` `read:self-assessment` |

### Redirect URIs

| Environment | Redirect URI | Notes |
|-------------|--------------|--------|
| Local | `http://127.0.0.1:PORT/api/hmrc/callback` | Dev only |
| Production (Railway) | `https://spreadsheet-tax-production.up.railway.app/api/hmrc/callback` | Sandbox OAuth today |

---

## 2. Scopes and authority

| Journey | Scopes | Status |
|---------|--------|--------|
| Individual | read + write self-assessment | **sandbox proven** |
| Agent | Agent Authorisation | **out of MVP** |

| ID | Work | Status | Evidence |
|----|------|--------|----------|
| H6 | Individual OAuth E2E (sandbox) | **done** | Playwright grant; `connected: true`, `mock: false` |
| H7 | Agent OAuth E2E | deferred | Practice beachhead later |
| H8 | Fraud-prevention headers + validate | **partial** | Honest pack; validate run; not full VALID_HEADERS green |
| H9 | Sandbox test-user strategy | **done** | Create Test User API + env storage |
| H10 | API version monitoring | open | Owner: Lee; versions SE 5.0 / Property 6.0 / BD 2.0 / Obl 3.0 |
| H11 | Revoked/expired authority runbook | open | [RUNBOOKS/hmrc-authority-expiry.md](./RUNBOOKS/hmrc-authority-expiry.md) |
| H12 | Cumulative-update conformance | partial | Payload builder cumulative shape; ADR pending depth |
| H13 | No shared multi-client access token | **done** | Per-user OAuth connection store |

---

## 3. API and payload conformance

| Check | Status | Evidence |
|-------|--------|----------|
| SE period summary schema | **sandbox 200** | Fixture plumber CSV → periodId |
| UK property schema | request built | Unit/pipeline tests |
| Foreign property schema | request built | Unit/pipeline tests |
| Business Details list | **sandbox 200** | businessId XBIS… |
| Obligations list | **code shipped** | `GET /api/hmrc/obligations` — re-run with live token |
| Rejection handling | partial | Errors returned to UI |
| Correlation / receipt IDs | partial | submission attempts + receipts API |

---

## 4. Fraud-prevention headers

| Family | Implemented | Validated | Notes |
|--------|-------------|-----------|-------|
| Connection-Method WEB_APP_VIA_SERVER | yes | yes | Constant |
| Browser-JS-User-Agent | yes | yes | From request |
| Device-ID | yes | yes | Client localStorage only |
| Public-IP | yes | yes | Proxy / socket |
| Public-Port | conditional | omit when unknown | **Never invent** |
| Timezone / screens / window | client-only | yes | No fake defaults |
| Multi-Factor | omit | warning possible | No MFA product yet |
| Vendor-Public-IP | env only | when set | `VENDOR_PUBLIC_IP` |
| Vendor version / product | yes | yes | Product identity |

Detail: [HMRC-FPH-AND-SANDBOX-SUBMIT.md](./HMRC-FPH-AND-SANDBOX-SUBMIT.md).

---

## 5. Sandbox test strategy

| Item | Detail |
|------|--------|
| Test users | Create Test User API; store NINO on Railway |
| NINO fixtures | Sandbox only — never real taxpayer NINOs in docs as live |
| Business IDs | From Business Details list |
| Automation | Playwright OAuth; unit tests offline |
| Manual | Load businesses / obligations on `/app` after connect |

---

## 6. Production separation

| Rule | Verified |
|------|----------|
| Production credentials never in local/CI | ☐ until Production exists |
| Staging cannot use production tokens | ☐ single Railway env today — treat carefully |
| Pilot live only after launch gate | **yes** — flag + OAuth gate |
| Token encryption at rest | partial — needs secret strength check |

---

## 7. Gate

**HMRC sandbox journey proven** when H1–H2, H4–H6, H8–H9, H13 pass (current: **largely yes**, H8 not full green).  
**HMRC production path open** when **H3**, H8 review by HMRC, H11, H13 + [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md).

Operator steps: [HMRC-PRODUCTION-ACCESS.md](./HMRC-PRODUCTION-ACCESS.md).

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Initial HMRC workstream |
| 2026-07-17 | Truth update: sandbox OAuth/SE/FPH evidence; H3 still open; Obligations API path added |
