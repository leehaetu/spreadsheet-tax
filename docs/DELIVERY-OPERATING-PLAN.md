# Delivery operating plan

**Status:** Executable backlog + governance  
**Accountable:** Lee Hine  
**Linked:** [ULTIMATE-PRODUCT-PLAN.md](./ULTIMATE-PRODUCT-PLAN.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md)

**Executable delivery is 10/10 only when:** every critical-path item has owner + date; launch requirements map to tests/evidence; ADRs recorded; data model approved; resourcing explicit; CI and environments exist; Phase 0 complete; no critical item depends on an undefined decision.

---

## 1. Capacity and resourcing (fill honestly)

| Role | Name / status | Hours/week available |
|------|---------------|----------------------|
| Engineering | Lee Hine / _TBD_ | |
| Design | | |
| Tax-domain reviewer | | |
| Security reviewer | | |
| Legal adviser | | |
| Customer research | | |
| Support owner | | |

| Constraint | Value |
|------------|-------|
| Weekly engineering delivery capacity (person-days) | |
| Design capacity | |
| External lead times (HMRC, legal, bank/payments) | |

**Rule:** Phase week estimates in the master plan are **aspirations** until this table is filled. Then re-forecast.

---

## 2. Environments

| Environment | Purpose | HMRC credentials | Real taxpayer data? | Deploy method | Access | Monitoring | Retention |
|-------------|---------|------------------|---------------------|---------------|--------|------------|-----------|
| **Local** | Dev | None / double only | No | `npm start` | Developer | Console | Ephemeral |
| **Automated test** | CI | Double only | No | GitHub Actions / CI | CI service | CI logs | Ephemeral |
| **Preview / staging** | QA demos | Sandbox only | No synthetic only | Railway preview / branch | Team | Basic | Short |
| **HMRC sandbox** | Integration | Sandbox OAuth | Sandbox test users only | Staging or dedicated | Restricted | Full | Per policy |
| **Controlled pilot** | Invited users | Sandbox first; live only if gate open | Pilot only, with consent | Production-like | Invite list | Full + on-call | Per pilot DPA |
| **Production** | Paying customers | Production OAuth only | Yes | Protected deploy | Least privilege | Full | Per retention schedule |

**Hard rules**

- Production must not start without session secret and secure config.  
- No shared multi-client access token in pilot/production.  
- Anonymous callers never receive live or sandbox server tokens.  

---

## 3. Delivery record template

Copy for every critical item:

```text
ID:
Deliverable:
Responsible (R):
Accountable (A):
Start date:
Target date:
Estimated effort:
Dependencies:
Risk level: critical | high | medium | low
Status: not_started | in_progress | blocked | done

Acceptance criteria:
-

Required tests / verification:
-

Evidence of completion:
-

Rollback plan:
-
```

---

## 4. Phase 0 backlog (authoritative — execute now)

### 0.1 Intentional worktree baseline

| Field | Value |
|-------|--------|
| ID | 0.1 |
| Deliverable | Review dirty worktree; commit intentional product state or explicitly discard |
| R / A | Eng / Lee Hine |
| Target date | _YYYY-MM-DD_ |
| Effort | 0.5–1 d |
| Dependencies | None |
| Risk | Medium (lost work / shipping accidental WIP) |
| Status | not_started |

**Acceptance:** `git status` clean on agreed branch; README/docs match shipped behaviour.  
**Verification:** Review diff; tests green.  
**Rollback:** Revert commit.  
**Evidence:** Commit SHA(s).

---

### 0.2 Prevent anonymous live / credentialed HMRC submissions

| Field | Value |
|-------|--------|
| ID | 0.2 |
| Deliverable | Anonymous requests cannot use server HMRC credentials; preview/double remains available |
| R / A | Eng / Lee Hine |
| Target date | _2026-07-21_ (example — set real date) |
| Effort | 1–2 d |
| Dependencies | None |
| Risk | Critical |
| Status | not_started |

**Acceptance criteria:**

- [ ] Anonymous requests cannot access sandbox or production credentials  
- [ ] Preview / double mode remains available without credentials  
- [ ] Server ignores browser-authored HMRC payloads as source of truth (or submit disabled until session drafts exist)  
- [ ] Production refuses to start without session secret (when auth lands; for now refuse live token without explicit allowlist)  
- [ ] Security events logged without tax identifiers  

**Verification:**

- [ ] Anonymous submission integration test  
- [ ] Authenticated path test (when auth exists) or explicit “submit disabled” test  
- [ ] Token-exposure scan (env not leaked in responses)  
- [ ] Manual API test of `/api/submit` unauthenticated  

**Rollback:** Feature flag to force double-only.  
**Evidence:** Test names + PR link.

---

### 0.3 Correct privacy / “records stay local” claims

| Field | Value |
|-------|--------|
| ID | 0.3 |
| Deliverable | All public and API claims accurate about file upload and retention |
| R / A | Product copy / Lee Hine |
| Effort | 0.5 d |
| Dependencies | None |
| Risk | High (trust / regulatory) |
| Status | not_started |

**Acceptance:** No “never leaves device” implication; `/api/status` and sales pages consistent.  
**Verification:** Grep + HTTP surface tests.  
**Evidence:** PR + test assert.

---

### 0.4 CI on every push

| Field | Value |
|-------|--------|
| ID | 0.4 |
| Deliverable | `npm test` in CI on push/PR |
| R / A | Eng / Lee Hine |
| Effort | 0.5 d |
| Dependencies | 0.1 preferred |
| Risk | Medium |
| Status | not_started |

**Acceptance:** Failing test blocks merge.  
**Evidence:** Workflow file + green run URL.

---

### 0.5 Cumulative-update decision note

| Field | Value |
|-------|--------|
| ID | 0.5 |
| Deliverable | Written decision (or explicit “pending research” with owner/date) |
| R / A | Domain / Lee Hine |
| Effort | 0.5–2 d |
| Dependencies | HMRC guidance review |
| Risk | Critical if wrong at live |
| Status | not_started |

**Evidence:** `docs/DECISIONS/000X-cumulative-updates.md`

---

### 0.6 Freeze writable professional APIs

| Field | Value |
|-------|--------|
| ID | 0.6 |
| Deliverable | No new unauthenticated practice write endpoints or workflow expansions |
| R / A | Eng / Lee Hine |
| Effort | Policy + optional middleware |
| Dependencies | None |
| Risk | High |
| Status | not_started |

**Acceptance:** PR checklist item; optional test that documents freeze.  
**Evidence:** Standing order in master plan + PR template.

---

### 0.7 Package names + CTAs locked (not prices)

| Field | Value |
|-------|--------|
| ID | 0.7 |
| Deliverable | Names/CTAs in strategy evidence doc |
| R / A | Product / Lee Hine |
| Effort | 0.5 d |
| Status | not_started |

---

### 0.8 Risk register maintenance

| Field | Value |
|-------|--------|
| ID | 0.8 |
| Deliverable | Master risk table reviewed weekly |
| R / A | Product / Lee Hine |
| Effort | Ongoing |
| Status | not_started |

---

### 0.9 Data model + identity design spike

| Field | Value |
|-------|--------|
| ID | 0.9 |
| Deliverable | Draft [DATA-MODEL.md](./DATA-MODEL.md) + auth ADR |
| R / A | Eng / Lee Hine |
| Effort | 1–2 d |
| Dependencies | None |
| Risk | High if skipped before Practice |
| Status | not_started |

**Evidence:** Approved draft schema; ADR in `DECISIONS/`.

---

## 5. Next 30 days (fill owners and dates)

| ID | Deliverable | R | Target | Depends | Status |
|----|-------------|---|--------|---------|--------|
| 0.1–0.9 | Phase 0 complete | | | | |
| S1 | Start customer interviews (see strategy evidence) | | | 0.7 | |
| S2 | Competitor matrix first pass | | | | |
| D1 | Auth method ADR | | | 0.9 | |
| D2 | Database/hosting ADR | | | 0.9 | |
| D3 | Draft submission / idempotency ADR | | | 0.2 | |
| H1 | HMRC Developer Hub registration | | | | |
| H2 | Sandbox app credentials | | | H1 | |
| G1 | Launch matrix rows started in SECURITY-LAUNCH-GATE | | | 0.2 | |
| P1 | Personal: server-owned import session design | | | 0.2, D3 | |

---

## 6. Required early ADRs

Create under `docs/DECISIONS/` (see templates there):

| ADR topic | Priority |
|-----------|----------|
| Database and hosting | P0 |
| Authentication method | P0 |
| Session storage | P0 |
| Firm-tenancy enforcement | P0 |
| OAuth token storage and encryption | P0 |
| Import-file retention | P0 |
| Spreadsheet parser replacement | P0 |
| Server-owned draft-submission model | P0 |
| Idempotency design | P0 |
| Audit-log immutability | P0 |
| Background jobs and reminders | P1 |
| Email provider | P1 |
| Billing provider | P1 |
| Monitoring and alerting | P1 |
| Backup and recovery | P0 |

---

## 7. Governance

| Cadence | Purpose | Owner |
|---------|---------|--------|
| Weekly product + risk review | Status, risks R1–R19, freeze held? | Lee Hine |
| Fortnightly customer-evidence review | Interviews, pricing signals | Lee Hine |
| Every release | Release checklist (below) | Eng |
| Every milestone | Live demo of journey | Eng |
| Continuous | ADR log for unresolved decisions | Eng |

### Definition of done (feature)

- [ ] Acceptance criteria met  
- [ ] Tests added/updated  
- [ ] No new open Critical risks introduced  
- [ ] Docs updated if user-facing or security-relevant  
- [ ] Rollback path known  
- [ ] Tenant/auth considered (or N/A documented)  

### Change control

Scope changes that touch Phase 4/5/HMRC require: written decision, risk impact, date slip, accountable approval.

### Requirement → test traceability

Maintain IDs: `0.2`, `H8`, `SEC-*` in tests where possible (`tests/` describe blocks or comments).

---

## 8. Release checklist (minimum)

- [ ] CI green  
- [ ] No Critical open risks unmitigated for this env  
- [ ] Correct environment credentials  
- [ ] Privacy claims match behaviour  
- [ ] Migrations applied (when DB exists)  
- [ ] Smoke: health, template download, import sample, status  
- [ ] Rollback plan known  

---

## 9. Delivery proof gate → 10/10 executable delivery

| Criterion | Met? |
|-----------|------|
| Every critical-path item has owner and date | ☐ |
| Every launch requirement maps to tests/evidence | ☐ |
| Required ADRs recorded | ☐ |
| Data model approved | ☐ |
| Dependencies and resourcing explicit (§1) | ☐ |
| CI and deployment environments exist (§2) | ☐ |
| Phase 0 completed | ☐ |
| No critical item relies on undefined future decision | ☐ |

---

## 10. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Initial delivery OS + Phase 0 records from Codex 10/10 guidance |
