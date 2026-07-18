# Master release gates (hard)

**Locked:** 2026-07-18  
**Owner:** Lee Hine  
**Status:** **OPEN** — none of the gates below are fully proven  

Implemented code, configured services, and **unexecuted** test scripts **do not** constitute proof.

---

## Final acceptance statement

**Spreadsheet Tax is complete only when tax correctness, submission integrity, tenant security, deadline resilience, recoverability and the 200-practice / 800,000-customer capacity target have all been demonstrated in a production-like environment.**

Until then the product **must not** be described as complete, pilot-ready, production-ready, or marketable at scale.

---

## 1. Tax correctness governance

| Requirement | Status |
|-------------|--------|
| Independent UK tax-domain review | **Not done** |
| Golden tests: SE, UK property, foreign, combined | Partial unit fixtures only |
| Cash-basis and traditional accounting cases | **Not done** |
| Joint property, Rent-a-Room, allowances, losses, capital allowances | Partial / incomplete |
| Penny-level reconciliation: spreadsheet → payload → HMRC readback → return | Partial (local traces) |
| Versioned tax rules by tax year | **Not done** |
| Documented process for HMRC rule/API changes | Partial (docs only) |

---

## 2. Submission integrity (immutable evidence chain)

Every submission must prove:

| Chain item | Status |
|------------|--------|
| Original file hash | Partial (import audit / check model) |
| Sanitised workbook version | Partial (`spreadsheetCheck`) |
| Mapping version | Partial (`v1-deterministic`) |
| Source cells | Partial (cell refs in check UI) |
| Adjustments | Partial |
| Approver | Partial (checkbox; not full identity lock) |
| Exact HMRC payload | Partial (attempt results) |
| Request correlation ID | **Not systematic** |
| Exact response | Partial |
| Readback | Partial (some workflows) |
| Receipt | Partial (local attempt id) |
| Superseding correction link | **Not done** |

---

## 3. Accountant authority and approval

| Requirement | Status |
|-------------|--------|
| Individual vs agent OAuth separate | **Not complete** |
| Firm authority checked per client | Partial membership checks |
| Preparer cannot self-approve when separation required | **Not enforced** |
| Client approval tied to locked figure set | Partial; re-upload invalidates UI approval |
| Approval expires on figure/mapping/id change | Partial (re-upload diff) |
| Revoked agent authority blocks submit | **Not done** |
| No bulk bypass of client-level authority | Policy only |

---

## 4. Capacity peak envelope (beyond 800k dormant rows)

Hard capacity target remains: **200 practices + 800,000 customers** (`CAPACITY-REQUIREMENTS.md`).

Additionally lock **measurable peak** requirements (fill numbers before launch; defaults TBD by Lee):

| Metric | Target (to lock) | Status |
|--------|------------------|--------|
| Concurrent signed-in users | _TBD_ | Unproven |
| Uploads / minute | _TBD_ | Unproven |
| Spreadsheet-processing jobs concurrent | _TBD_ | Unproven |
| HMRC submissions / minute | _TBD_ | Unproven |
| Largest workbook size | e.g. 5–10 MB | Partial limit |
| Largest practice portfolio | tens of thousands clients | Unproven |
| Queue recovery after HMRC outage | _TBD_ | Unproven |
| p50 / p95 / p99 response times | See capacity doc draft | Unproven |
| Max error rate under peak | _TBD_ | Unproven |

**Must test deadline traffic**, not only a DB with 800k idle records.

---

## 5. Zero-downtime database migration (SQLite → PostgreSQL)

| Requirement | Status |
|-------------|--------|
| Verified migration tooling | **Not done** |
| Row-count and checksum reconciliation | **Not done** |
| Encrypted migration backups | **Not done** |
| Rollback procedure | **Not done** |
| Rehearsal with production-sized data | **Not done** |
| No duplicate/lost submission records | Unproven |
| Online schema migrations multi-version | **Not done** |

---

## 6. Deadline-day resilience

| Requirement | Status |
|-------------|--------|
| Visible HMRC service-status messaging | **Not done** |
| Accepted-but-pending states | **Not done** |
| Queue backpressure | Partial (queue code) |
| Safe retries + idempotency | Partial |
| No automatic figure change | Policy + code honesty |
| No submit without existing approval | Partial |
| Customer evidence of attempt | Partial receipts |
| Backlog-drain after HMRC recovery | **Not done** |
| Support staffing plan for deadlines | Human / ops |

---

## 7. Disaster recovery

| Requirement | Status |
|-------------|--------|
| RTO defined | **Not defined** |
| RPO defined | **Not defined** |
| Postgres PITR | Needs managed PG |
| Object-storage versioning | **Not done** |
| Redis-loss behaviour | Documented as unknown |
| Queue reconstruction | **Not done** |
| Provider failure plan | **Not done** |
| Restore exercise on realistic volume | **Not done** |

A backup never restored is **not** evidence.

---

## 8. Security assurance

| Requirement | Status |
|-------------|--------|
| Independent penetration test | **Not done** |
| Threat model | Partial honesty docs |
| CSRF + account-takeover protection | CSRF open |
| MFA for practice admins | **Not done** |
| Dependency/container scanning | Partial (`npm audit`) |
| Secret rotation | **Not done** |
| Security-event alerts | **Not done** |
| Malware + zip-bomb tests | Stub / partial |
| Formula-injection / malicious workbook tests | Partial |
| Tenant isolation under concurrency | Partial unit tests |
| Responsible disclosure process | **Not done** |

---

## 9. Privacy and data lifecycle

| Requirement | Status |
|-------------|--------|
| Lifecycle for original spreadsheets | Partial quarantine |
| Extracted cells | In drafts/reviews |
| NINOs / HMRC identifiers | Stored; retention unclear |
| OAuth tokens | Encrypted at rest when keyed |
| Audit evidence retention | Partial |
| Support exports | Partial CSV |
| Backups lifecycle | **Not operational** |
| Closed accounts / deletion | **Not complete** |
| SAR / deletion requests process | **Not complete** |

---

## 10. Accessibility and assisted journeys

| Requirement | Status |
|-------------|--------|
| WCAG 2.2 AA assessment | **Not done** |
| Keyboard-only submission | Unproven |
| Screen-reader status | Unproven |
| Mapping states colour-independent | Partial tags/text |
| Zoom 200% | Unproven |
| Accountant-assisted journey design | Partial portal |

---

## 11. Production operations

| Requirement | Status |
|-------------|--------|
| Staging = production shape | **Not done** |
| Infrastructure as code | Partial Railway only |
| Controlled deploy + rollback | Partial |
| Migration gates | **Not done** |
| Logs without tax figures/NINOs | Partial policy |
| Metrics, traces, alerts | **Not done** |
| On-call ownership | Human |
| Incident severities | **Not done** |
| Public status page | **Not done** |
| Support → engineering escalation | Human |
| HMRC credential rotation | Human process |

---

## 12. Commercial SaaS operation

| Requirement | Status |
|-------------|--------|
| Real billing/payments | Stub only |
| Server-side entitlements | Partial plans |
| Practice licensing / client limits | **Not done** |
| Failed-payment never blocks statutory receipts | **Not designed** |
| Transactional email | Stub |
| Support tooling | Minimal |
| Terms, privacy, DPA | Partial pages |
| Unit-cost model for 800k | **Not done** |

---

## Related docs

- `CAPACITY-REQUIREMENTS.md` — 200 / 800k hard gate  
- `SECURITY-LAUNCH-GATE.md` — security matrix  
- `PLATFORM-IMPLEMENTATION.md` — what code exists vs operating  
- `AGENT-TRUTH-PROTOCOL.md` — no overclaim  
- `STATUS.md` — living truth  

## What “proof” means

For each gate: **named test or exercise + date + environment + result artifact** linked from STATUS.  
“Script exists” or “code path exists” is **ROUTE_ONLY / UNIT_TESTED**, not gate MET.
