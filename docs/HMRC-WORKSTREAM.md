# HMRC workstream

**Status:** Critical-path operational checklist  
**Accountable:** Lee Hine  
**Linked:** [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

This is more than engineering. Production access has lead times outside the repo.

---

## 1. Registration and credentials

| ID | Work | Owner | Target | Status | Evidence |
|----|------|-------|--------|--------|----------|
| H1 | Developer Hub application registered | | | not_started | App id |
| H2 | Sandbox client id/secret secured | | | not_started | Secret manager ref |
| H3 | Production application / approval | | | not_started | Approval record |
| H4 | Redirect URIs per environment documented | | | not_started | ADR / table below |
| H5 | Scope matrix documented | | | not_started | This file §2 |

### Redirect URIs

| Environment | Redirect URI | Notes |
|-------------|--------------|--------|
| Local | | |
| Staging | | |
| Production | | |

---

## 2. Scopes and authority

| Journey | Scopes required | Status |
|---------|-----------------|--------|
| Individual | | TBD from HMRC docs |
| Agent | | TBD |

| ID | Work | Status | Evidence |
|----|------|--------|----------|
| H6 | Individual OAuth E2E (sandbox) | not_started | Test recording / automated |
| H7 | Agent OAuth E2E (sandbox) | not_started | |
| H8 | Fraud-prevention headers implemented + validated | not_started | Checklist vs HMRC guidance |
| H9 | Sandbox test-user strategy documented | not_started | User list + scripts |
| H10 | API version + deprecation monitoring owner | not_started | Owner name + cadence |
| H11 | Revoked/expired authority runbook | not_started | [RUNBOOKS/hmrc-authority-expiry.md](./RUNBOOKS/hmrc-authority-expiry.md) |
| H12 | Cumulative-update conformance | not_started | Decision + tests |
| H13 | No shared multi-client access token in pilot/prod | not_started | Architecture review |

---

## 3. API and payload conformance

| Check | Status | Evidence |
|-------|--------|----------|
| Current SE period summary schema | | |
| UK property schema | | |
| Foreign property schema | | |
| Cumulative vs period behaviour matches guidance | | |
| Rejection handling | | |
| Correlation / receipt IDs stored | | |

---

## 4. Fraud-prevention headers

Track each required header family against current HMRC guidance (update when guidance changes).

| Header / family | Implemented | Validated in sandbox | Notes |
|-----------------|-------------|----------------------|-------|
| | ☐ | ☐ | |
| | ☐ | ☐ | |

**Owner of guidance watch:** _

---

## 5. Sandbox test strategy

| Item | Detail |
|------|--------|
| Test users | |
| NINO fixtures | Sandbox only |
| Business IDs | Sandbox only |
| Automation | |
| Manual checklist | |

---

## 6. Production separation

| Rule | Verified |
|------|----------|
| Production credentials never in local/CI | ☐ |
| Staging cannot use production tokens | ☐ |
| Pilot live only after launch gate | ☐ |
| Token encryption at rest | ☐ |

---

## 7. Gate

**HMRC sandbox journey proven** when H1–H2, H4–H9, H12 pass.  
**HMRC production path open** when H3, H8, H11, H13 + security gate pass.

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Initial HMRC workstream |
