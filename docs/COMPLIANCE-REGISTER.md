# Compliance register

**Status:** Living legal / privacy / operational compliance  
**Accountable:** Lee Hine  
**Linked:** [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md) · [DATA-MODEL.md](./DATA-MODEL.md)

Legal review where appropriate. This is not legal advice; it is a control checklist.

---

## 1. Data inventory (high level)

| Data category | Examples | Lawful basis (draft) | Stored where | Retention intent |
|---------------|----------|----------------------|--------------|------------------|
| Account identity | email, name | Contract / legitimate interest | DB | Account life + legal |
| Tax identifiers | NINO, business IDs | Contract | Encrypted / minimise | Period + legal |
| Spreadsheet contents | income/expense lines | Contract | Memory and/or short retain | Prefer delete post-process |
| Submission artefacts | payloads, receipts | Contract / legal obligation | DB | Tax year + N |
| Auth tokens | HMRC OAuth | Contract | Encrypted | Until expiry/revoke |
| Audit logs | actions | Legitimate interest / legal | Append-only store | Long |
| Marketing | email if opted | Consent / soft opt-in rules | ESP | Until withdraw |
| Billing | customer, plan | Contract | Billing provider | Per provider + tax |

**Data-flow diagram:** _link or attach when drawn_  
**Last inventory review:** _

---

## 2. Privacy and legal pack

| Item | Owner | Status | Location / link | Review date |
|------|-------|--------|-----------------|-------------|
| UK GDPR lawful-basis assessment | | open | | |
| Privacy notice | | open | /legal or /privacy | |
| Cookie policy | | open | | |
| Terms of service | | open | | |
| Data-processing agreements | | open | | |
| Subprocessor register (§3) | | open | this file | |
| Retention and deletion schedule (§4) | | open | this file | |
| Subject-access procedure | | open | RUNBOOKS | |
| Deletion procedure | | open | RUNBOOKS | |
| Incident-response process | | open | RUNBOOKS | |
| Client-consent evidence (agent submit) | | open | product + policy | |
| Insurance decision (PI / cyber) | | open | | |
| External legal review | | open | | |

---

## 3. Subprocessor register

| Processor | Purpose | Data | Location | DPA in place? |
|-----------|---------|------|----------|---------------|
| Railway (or host) | App hosting | App data | | ☐ |
| _Email provider_ | Transactional email | email | | ☐ |
| _Payments_ | Billing | billing identity | | ☐ |
| _Error monitoring_ | Diagnostics | redacted errors | | ☐ |
| HMRC | Tax API | submission data | UK gov | N/A statutory |

---

## 4. Retention schedule (draft)

| Record type | Retain | Delete/anonymise |
|-------------|--------|------------------|
| Raw upload bytes | Prefer 0–7 days or none | After map |
| Import metadata | 7 years or policy | |
| Draft submissions | Tax year + 1 | |
| Submission attempts / receipts | 7 years typical | |
| HMRC tokens | Until revoke/expiry | Immediate on revoke |
| Audit events | 7+ years | |
| Support tickets | 3 years | |
| Marketing | Until opt-out | |

**Confirm with counsel before production.**

---

## 5. Accessibility

| Target | Status |
|--------|--------|
| WCAG 2.2 AA | open — assessment required before Production ready |

---

## 6. Intellectual property and licensing

| Item | Status |
|------|--------|
| IP owned by Lee Hine (LICENSE) | Present |
| Modifications belong to Lee Hine | Present |
| Company license to resell subscriptions | Terms draft needed for commercial Practice |
| Customer ToS aligns with LICENSE | open |

---

## 7. Production compliance gate

| Criterion | Met? |
|-----------|------|
| Data inventory current | ☐ |
| Lawful basis documented | ☐ |
| Privacy notice + ToS live | ☐ |
| Subprocessors listed + DPAs where required | ☐ |
| Retention/deletion operable | ☐ |
| SAR and deletion tested once | ☐ |
| Incident process named owners | ☐ |
| Agent client-consent model documented | ☐ |
| Insurance decision recorded | ☐ |
| Accessibility assessment done or risk accepted | ☐ |

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Initial compliance register |
