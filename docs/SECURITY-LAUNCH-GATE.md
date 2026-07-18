# Security and launch gate

**Status:** Requirement → evidence matrix  
**Accountable:** Lee Hine  
**Linked:** [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md) · [COMPLIANCE-REGISTER.md](./COMPLIANCE-REGISTER.md) · [RUNBOOKS/](./RUNBOOKS/)

**Honesty rule:** Safety and launch discipline cannot be 10/10 until controls are **implemented**, **independently tested**, and **proven in a real pilot**. This document is the scoreboard.

**Any open Critical or unaccepted High risk = no production launch.**

---

## 1. Go / no-go authority

| Role | Name | Sign-off date | Go? |
|------|------|---------------|-----|
| Product owner | Lee Hine | | ☐ |
| Engineering owner | | | ☐ |
| Security reviewer | | | ☐ |
| Tax-domain reviewer | | | ☐ |
| Privacy/legal reviewer | | | ☐ |
| Operations/support owner | | | ☐ |

**Decision:** GO / NO-GO · **Date:** _ · **Notes:** _

---

## 2. Security controls matrix

| ID | Control | Required for | Implemented | Tested | Evidence | Status |
|----|---------|--------------|-------------|--------|----------|--------|
| SEC-01 | Secure authentication | Pilot | ☑ | ☑ | auth-drafts tests | partial |
| SEC-02 | MFA for professional admins | Pilot+ | ☐ | ☐ | | open — EXT human |
| SEC-03 | Short-lived secure sessions | Pilot | ☑ | ☑ | 7-day sessions HttpOnly | partial |
| SEC-04 | CSRF protection | Pilot | ☐ | ☐ | | open |
| SEC-05 | Rate limiting | Pilot | ☑ | ☑ | submit rate limit | partial |
| SEC-06 | Account lockout controls | Pilot | ☐ | ☐ | | open |
| SEC-07 | Role + tenant authz on every protected op | Pilot | ☑ | ☑ | tenant-isolation.test.js · access-control.js | improved 2026-07-18 |
| SEC-08 | Encrypted HMRC tokens | Pilot | ☑ | ☑ | crypto-secret + prod boot requires key | partial (prod boot gate) |
| SEC-09 | Secret rotation process | Prod | ☐ | ☐ | | open — runbook |
| SEC-10 | Security headers | Staging | ☑ | ☑ | CSP/XFO in server.js | partial |
| SEC-11 | Input and file validation | Demo+ | ☑ | ☑ | multer + validation | partial |
| SEC-12 | Safe spreadsheet parser | Pilot | ☑ | ☑ | CSV preferred; xlsx limits + prod opt-in parse-xlsx-safety.test.js | risk-accepted w/ controls |
| SEC-13 | Malware/malformed-file handling | Prod | ☐ | ☐ | | open |
| SEC-14 | Server-owned submission drafts | Pilot | ☑ | ☑ | drafts + ownership | improved |
| SEC-15 | Idempotency + duplicate prevention | Pilot | ☑ | ☑ | user-scoped keys | improved |
| SEC-16 | Redacted logs | Demo+ | ☑ | ☐ | NINO slice in audit | partial |
| SEC-17 | Immutable audit events | Pilot | ☑ | ☑ | audit_events | partial |
| SEC-18 | Dependency / container scanning | Staging | ☐ | ☐ | npm audit known xlsx | open |
| SEC-19 | No anonymous credentialed HMRC submit | **Demo** | ☑ | ☑ | submit requires user for non-double | improved |
| SEC-20 | Production refuses insecure boot | Prod | ☑ | ☑ | production-boot.js + tests | improved |

---

## 3. HMRC controls matrix

| ID | Control | Implemented | Proven | Evidence | Status |
|----|---------|-------------|--------|----------|--------|
| HMRC-01 | Individual OAuth journey | ☐ | ☐ | | open |
| HMRC-02 | Agent OAuth journey | ☐ | ☐ | | open |
| HMRC-03 | Revocation/expiry recovery | ☐ | ☐ | | open |
| HMRC-04 | Correct scopes | ☐ | ☐ | | open |
| HMRC-05 | Correct API versions/payloads | ☐ | ☐ | | open |
| HMRC-06 | Cumulative-update behaviour | ☐ | ☐ | | open |
| HMRC-07 | Fraud-prevention headers | ☐ | ☐ | | open |
| HMRC-08 | Sandbox rejection handling | ☐ | ☐ | | open |
| HMRC-09 | Production credential separation | ☐ | ☐ | | open |
| HMRC-10 | No shared multi-client token | ☐ | ☐ | | open |
| HMRC-11 | Receipts + correlation IDs | ☐ | ☐ | | open |

Detail: [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md).

---

## 4. Privacy and legal (pointer)

Full list in [COMPLIANCE-REGISTER.md](./COMPLIANCE-REGISTER.md). Launch requires that register’s production gate.

---

## 5. Operational controls

| ID | Control | Implemented | Tested | Evidence | Status |
|----|---------|-------------|--------|----------|--------|
| OPS-01 | Health monitoring | ☐ | ☐ | | open |
| OPS-02 | Error and security alerts | ☐ | ☐ | | open |
| OPS-03 | On-call ownership | ☐ | ☐ | | open |
| OPS-04 | Incident severity definitions | ☐ | ☐ | RUNBOOKS | open |
| OPS-05 | Backup schedule | ☐ | ☐ | | open |
| OPS-06 | Tested restoration | ☐ | ☐ | DR exercise date | open |
| OPS-07 | RTO / RPO documented | ☐ | ☐ | | open |
| OPS-08 | Deployment rollback | ☐ | ☐ | | open |
| OPS-09 | Status communication | ☐ | ☐ | | open |
| OPS-10 | Support escalation | ☐ | ☐ | | open |
| OPS-11 | HMRC deadline capacity plan | ☐ | ☐ | | open |
| OPS-12 | Vulnerability response process | ☐ | ☐ | | open |

---

## 6. Quality controls

| ID | Control | Passed | Evidence | Status |
|----|---------|--------|----------|--------|
| QA-01 | Unit + integration tests | ☐ | CI | open |
| QA-02 | Browser E2E | ☐ | | open |
| QA-03 | Cross-tenant attack tests | ☐ | | open |
| QA-04 | WCAG 2.2 AA assessment | ☐ | | open |
| QA-05 | Performance / load (practice portfolio) | ☐ | | open |
| QA-06 | Malicious file tests | ☐ | | open |
| QA-07 | Retry / duplicate submission tests | ☐ | | open |
| QA-08 | Expired-token tests | ☐ | | open |
| QA-09 | Disaster-recovery exercise | ☐ | | open |
| QA-10 | Independent penetration test | ☐ | Report | open |
| QA-11 | Tax-domain review | ☐ | | open |
| QA-12 | Controlled pilot without critical incidents | ☐ | Pilot report | open |

---

## 7. Open launch risks

| ID | Severity | Description | Accepted? | Owner | Close-by |
|----|----------|-------------|-----------|-------|----------|
| | Critical | | Must close | | |
| | High | | Accept only with signature | | |

---

## 8. Pilot evidence

| Item | Result |
|------|--------|
| Pilot start / end | |
| Cohorts | SE _ · landlords _ · pros _ · firms _ |
| Critical incidents | |
| High incidents | |
| Support load | |
| Go recommendation | |

---

## 9. 10/10 safety posture criteria

| Criterion | Met? |
|-----------|------|
| All mandatory SEC/HMRC/OPS for production marked Proven | ☐ |
| No open Critical risks | ☐ |
| High risks resolved or formally accepted with signature | ☐ |
| Restoration tested | ☐ |
| Pilot completed without critical incidents | ☐ |
| Go/no-go signed by all authorities | ☐ |

**Until then: maximum honest score is “strong plan / partial implementation.”**

---

## 10. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Initial launch gate matrix |
