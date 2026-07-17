# Plan to complete web sales + web app

**Status:** Authoritative completion plan (execute, don’t re-plan)  
**Accountable:** Lee Hine  
**Date:** 2026-07-17  
**Hub:** [ULTIMATE-PRODUCT-PLAN.md](./ULTIMATE-PRODUCT-PLAN.md) · **OS index:** [README.md](./README.md)

---

## 0. Honest starting point

| Area | Framework | Current reality |
|------|-----------|-----------------|
| Product strategy | 10/10 structure | ~7/10 until interviews, competitors, paid intent |
| Executable delivery | 10/10 OS | ~7/10 until owners, dates, ADRs, CI, Phase 0 done |
| Safety & launch | 10/10 gate design | ~3–4/10 until auth, tenancy, OAuth, secure parse, audit |
| Web sales site | Partial pages | Not conversion-complete |
| Web app (Personal) | Wizard + validation + samples | No accounts, no server drafts, no real HMRC OAuth |
| Web app (Practice) | Demo workflow (in-memory) | **Frozen** until auth/tenancy |

**Planning framework is done.** More strategy prose has diminishing value.  
**This document is the path to a finished sales site and finished web app** (Demo → Pilot → Production).

**Housekeeping (Codex):**

1. **Commit `docs/` and intentional product WIP** — untracked docs are not durable until committed.  
2. **HMRC detail lives in one place** — [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md); master plan only links (avoid dual lists drifting).  
3. **Blank owners/dates are correct now** — filling them is what turns the OS into reality (see §8).

---

## 1. Definition of done

### 1.1 Web sales site — **Sales complete**

A stranger can land, self-select, understand price direction, and start the right product path.

| # | Done criterion | Evidence |
|---|----------------|----------|
| S1 | Hub with 4 audience routes (SE, landlord, pro, firm) | Live pages + first-click tests |
| S2 | Full segment pages (problem → promise → steps → CTA → FAQ) | Content complete on each |
| S3 | Pricing page with package **names** + hypothesis prices (labelled experimental until evidence) | `/pricing` |
| S4 | How it works, templates, security/privacy (accurate), help, license, legal | Site map live |
| S5 | CTAs instrumented (analytics or logged events) | Events for key CTAs |
| S6 | Privacy/HMRC claims match real behaviour | Grep + review |
| S7 | Moderated “10 second” targets measured once | Strategy evidence log |

**Out of scope for “sales complete”:** paid ads optimisation, full blog SEO empire.

### 1.2 Web app Personal — **App Personal complete** (by readiness)

| State | Done means |
|-------|------------|
| **Demo complete** | Free check: upload/sample → validate → review figures → preview submit (double); no live token abuse; honest copy |
| **Pilot ready** | Account → server draft → sandbox OAuth submit → receipt → history |
| **Production ready** | Live HMRC + billing + monitoring + launch gate signed |

### 1.3 Web app Practice — **App Practice complete** (by readiness)

| State | Done means |
|-------|------------|
| **Demo complete** | Read-only or clearly demo portfolio; **no new unauthenticated writes** |
| **Pilot ready** | Auth + firm tenancy + client book + import-for-client + workflow + audit on DB |
| **Production ready** | Agent/individual authority, fraud headers, multi-user, billing/seats, gate signed |

### 1.4 Product “complete enough to sell publicly”

= **Sales complete** + **Personal Pilot ready** + **Practice Pilot ready** (or Practice deferred with honest sales copy) + **no open Critical launch risks**.

Public **live** sell = **Production ready** gate in [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md).

---

## 2. Sequencing (do not reorder casually)

```text
WEEK 0          Phase 0 — Safety + preserve worktree + freeze Practice writes
                │
                ├─► Track SALES     Phase 1 evidence (parallel, light) → Phase 2 sales site complete
                │
                ├─► Track PERSONAL  Phase 3 app (demo polish → pilot features)
                │
                └─► Track FOUNDATION Phase 4 auth, data model, HMRC, security
                         │
                         └─► Track PRACTICE  Phase 5 (only after auth/tenancy)
                                  │
                                  └─► Phase 6 design polish · Phase 7 pilot · Phase 8 billing/launch
```

**Beachhead (commercial):** professionals managing **20–200** spreadsheet clients — [PRODUCT-STRATEGY-EVIDENCE.md](./PRODUCT-STRATEGY-EVIDENCE.md).  
**Personal** stays a first-class app and sales path; pros are preferred **distribution** for first revenue.

---

## 3. Phase 0 — Execute now (no more planning)

**Goal:** Durable OS in git · safe demo · Practice freeze · foundation started.  
**Owner default:** Lee Hine · **Detail records:** [DELIVERY-OPERATING-PLAN.md](./DELIVERY-OPERATING-PLAN.md) §4  

| ID | Action | Acceptance | Effort |
|----|--------|------------|--------|
| **0.1** | Review dirty worktree; **commit** intentional product + **entire `docs/`** | Clean intentional history on branch; docs tracked | 0.5–1 d |
| **0.2** | Block anonymous **credentialed** HMRC submit; keep double/preview | Tests: unauth cannot use token; preview works | 1–2 d |
| **0.3** | Fix privacy / “records stay local” claims site-wide + API | Accurate wording; tests if applicable | 0.5 d |
| **0.4** | Add CI (`npm test` on push/PR) | Green workflow on GitHub | 0.5 d |
| **0.5** | Cumulative-update decision note (or explicit pending + owner) | ADR or `DECISIONS/` note | 0.5 d |
| **0.6** | Freeze writable professional APIs (PR rule + no new endpoints) | Standing order enforced | 0.25 d |
| **0.7** | Confirm package **names** + CTAs (not final prices) | Strategy evidence table | 0.25 d |
| **0.8** | Risk register weekly owner | Lee Hine | ongoing |
| **0.9** | Approve/iterate data model + first ADRs (0001, 0002, 0008 min) | Decision status → Accepted where ready | 1–2 d |

**Phase 0 exit:** Demo is safe to leave public; git has docs+code baseline; CI exists; Practice not expanding; schema/ADR direction clear.

**Stop doing in Phase 0:** new Practice features, live HMRC with shared token, final public price list without interviews.

---

## 4. Complete the web sales site

**Phases:** 1 (light, parallel) + 2 (build)  
**Depends on:** 0.3 privacy done; 0.1 committed pages  

### 4.1 Content & structure backlog

| ID | Deliverable | Path | Priority |
|----|-------------|------|----------|
| SALE-01 | Hub conversion redesign (route selector, one primary CTA per card) | `/` | P0 |
| SALE-02 | Self-employed landing complete | `/self-employed` | P0 |
| SALE-03 | Landlords landing complete | `/landlords` | P0 |
| SALE-04 | Bookkeepers & accountants landing (beachhead messaging) | `/professionals` | P0 |
| SALE-05 | Accountancy firms + license CTA | `/firms`, `/license` | P0 |
| SALE-06 | Pricing page (5 packages, experimental prices labelled) | `/pricing` | P0 |
| SALE-07 | How it works | `/how-it-works` | P1 |
| SALE-08 | Templates / lead magnet page | `/templates` | P1 |
| SALE-09 | Security & HMRC trust page (accurate) | `/security` | P0 |
| SALE-10 | Help centre (minimal FAQs) | `/help` | P1 |
| SALE-11 | Shared header/footer + mobile nav | all | P0 |
| SALE-12 | Analytics events on CTAs | all | P1 |
| SALE-13 | Screenshot/walkthrough of real app review screen | hub + how-it-works | P1 |

### 4.2 Sales quality bar

- Segment pages do **not** mix sole-trader and firm-management journeys.  
- Practice CTAs say **demo / pilot / book call** until Practice Pilot ready.  
- Personal CTAs: **Check my spreadsheet** → `/app`.  
- Pass moderated targets once (see strategy evidence).  

### 4.3 Sales exit → “Sales complete”

All SALE-01…06, 09, 11 done; S1–S7 in §1.1 checked.

**Parallel (not blocking sales pages):** start interviews in [PRODUCT-STRATEGY-EVIDENCE.md](./PRODUCT-STRATEGY-EVIDENCE.md) (5 SE, 5 landlords, 5 pros, 2 firms).

---

## 5. Complete the web app — Personal

**Phase 3** · shell: `/app`  
**Depends on:** Phase 0 safety; pilot features depend on Phase 4 auth + drafts  

### 5.A Demo complete (ship first)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| PER-01 | Audience modes (`?mode=self-employed` / property) from sales CTAs | Copy + samples match |
| PER-02 | Validation panel + blocked continue on errors | Exists; keep solid |
| PER-03 | Figure cards, mapping table, metrics | Customer-grade, not raw JSON primary |
| PER-04 | Double/preview submit only when no user OAuth | Aligned with 0.2 |
| PER-05 | Templates download SE / property / combined | From app + sales |
| PER-06 | Empty/error/loading states | Polished |

**Exit A:** First-time user completes free check + review without help (sandbox/double).

### 5.B Pilot ready (after foundation)

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| PER-10 | Sign up / sign in | Session cookie |
| PER-11 | Server-owned import + draft_submission | Submit by id only ([ADR 0008](./DECISIONS/0008-draft-submission-model.md)) |
| PER-12 | States: draft / ready / submitted | Visible in UI |
| PER-13 | HMRC connect (individual OAuth sandbox) | H6 |
| PER-14 | Submit sandbox + receipt download | Receipt stored |
| PER-15 | History list | Prior periods |
| PER-16 | Saved mapping profile (basic) | Reuse on re-upload |
| PER-17 | Multi source SE + UK + foreign in one file | Already pipeline; UX clear |

**Exit B:** Authenticated sandbox submission unaided + receipt + history.

### 5.C Production ready (launch gate)

| ID | Deliverable |
|----|-------------|
| PER-20 | Live HMRC (after approval) + fraud headers |
| PER-21 | Corrections / resubmit journey |
| PER-22 | Deadlines reminders (email) |
| PER-23 | Billing entitlement (Personal plan) |

**Exit C:** Security gate + billing for Personal.

---

## 6. Complete the web app — Practice (after freeze lifts)

**Phase 5** · **Blocked by:** auth + tenancy + DB ([DATA-MODEL.md](./DATA-MODEL.md))  
**Do not expand public demo APIs before that.**

### 6.A Replace demo with real workspace

| ID | Deliverable | Acceptance |
|----|-------------|------------|
| PRA-01 | `/workspace` shell (sidebar nav) | Accountancy density |
| PRA-02 | Clients CRUD scoped by firm_id | Cross-tenant tests fail closed |
| PRA-03 | Workflow statuses on real clients | Transitions enforced |
| PRA-04 | Import-for-client → same engine as Personal | Draft linked to client_id |
| PRA-05 | Review queue + filters | Status, assignee, deadline |
| PRA-06 | Audit events on changes | Append-only |
| PRA-07 | Portal invite (client sees own data only) | Authz tests |
| PRA-08 | Team memberships + roles | practice_admin / accountant / bookkeeper |
| PRA-09 | Reassignment within firm only | Exists in demo; re-prove on DB |

### 6.B Beachhead fitness (20–200 clients)

| ID | Deliverable |
|----|-------------|
| PRA-10 | Performance OK at 200 clients list |
| PRA-11 | Bulk status view / “needs action” dashboard |
| PRA-12 | Export submission list CSV |
| PRA-13 | Practice settings + HMRC connection status |

### 6.C Production Practice

| ID | Deliverable |
|----|-------------|
| PRA-20 | Agent OAuth path where offered |
| PRA-21 | Client consent evidence before agent submit |
| PRA-22 | Seats / Practice license entitlements |
| PRA-23 | Company resale terms alignment (Lee Hine IP) |

**Exit Practice Pilot:** accountant processes multiple clients without using only Personal wizard; all data tenant-scoped.

---

## 7. Foundation (parallel spine)

**Phase 4** · detail: delivery plan + security gate + HMRC workstream  

| ID | Deliverable | Unblocks |
|----|-------------|----------|
| FND-01 | PostgreSQL (or chosen DB) + migrations | Everything durable |
| FND-02 | Auth sessions (ADR 0002/0003) | Pilot |
| FND-03 | Implement data model tables (MVP subset first) | Personal drafts + Practice |
| FND-04 | Tenant middleware | Practice |
| FND-05 | HMRC Hub register + sandbox (H1–H2) | OAuth |
| FND-06 | OAuth individual sandbox (H6) | Personal pilot submit |
| FND-07 | Fraud-prevention headers (H8) | Live |
| FND-08 | Replace/isolate `xlsx` (ADR 0007) | Production |
| FND-09 | Idempotency (ADR 0009) | Safe submit |
| FND-10 | Rate limits, security headers, redacted logs | Pilot |
| FND-11 | Monitoring + backups | Production |
| FND-12 | Compliance pack start (privacy notice, ToS) | Production sales |

**MVP schema first (minimum for pilot):**  
`users`, `firms`, `firm_memberships`, `clients`, `imports`, `draft_submissions`, `hmrc_connections`, `submission_attempts`, `receipts`, `audit_events`.

---

## 8. Thirty-day execution calendar

Fill **R** and exact dates in [DELIVERY-OPERATING-PLAN.md](./DELIVERY-OPERATING-PLAN.md); defaults below assume solo/small team.

| Days | Focus | Outcomes |
|------|--------|----------|
| **1–2** | Phase 0.1–0.3 | Commit docs+WIP; block credentialed anon submit; privacy fixed |
| **3–4** | Phase 0.4–0.6, 0.9 | CI; freeze; ADR/data model pass |
| **5–7** | Sales P0 pages | SALE-01…06, 09, 11 |
| **8–12** | Personal Demo polish | PER-01…06; sales deep links |
| **8–15** | Foundation start | FND-01…03 spike → implement auth skeleton |
| **13–20** | Personal Pilot path | PER-10…14 if auth ready; else continue sales/help |
| **16–25** | HMRC H1–H2, draft OAuth | Sandbox app live |
| **21–30** | Practice design only / or start PRA-01 behind auth | No public unauth writes |
| **Ongoing** | Interviews | Strategy evidence log |

**Week 4 checkpoint labels (allowed claims only):**

- Sales: “Sales complete” or “Sales 70%”  
- App: “Demo complete” or better  
- Never: “Production ready” without gate  

---

## 9. Workstream owners (assign names)

| Workstream | Accountable | Responsible (fill) |
|------------|-------------|-------------------|
| Phase 0 / safety | Lee Hine | |
| Sales site | Lee Hine | |
| Personal app | Lee Hine | |
| Practice app | Lee Hine | |
| Data / auth | Lee Hine | |
| HMRC | Lee Hine | |
| Compliance | Lee Hine | |
| Customer interviews | Lee Hine | |

---

## 10. Test and evidence map (sales + app)

| Area | Must prove | Where |
|------|------------|--------|
| Template download | Non-empty CSV attachment | `tests/http-surfaces` |
| Import SE/UK/foreign | Fixtures | `tests/pipeline`, test-spreadsheets |
| Validation blocks bad submit | 422 + UI | `tests/validation` |
| Anon no credentials | 0.2 | New tests |
| Sales no AI claims | Policy | `tests/policy` |
| Cross-tenant isolation | Practice pilot | New tests |
| OAuth sandbox submit | Pilot | Manual + automated where possible |
| Launch | Full matrix | SECURITY-LAUNCH-GATE |

---

## 11. Explicit non-goals until after pilot

- Full general ledger / bank feeds  
- Feature parity with Xero/QBO  
- Native iOS/Android beyond WebView  
- International tax  
- Unauthenticated live HMRC  
- Growing in-memory Practice as if production  

---

## 12. Milestone scoreboard

| Milestone | Target label | Exit |
|-----------|--------------|------|
| M0 | Phase 0 done | §3 exit |
| M1 | Sales complete | §1.1 |
| M2 | Personal Demo complete | §5.A |
| M3 | Foundation pilot core | Auth + drafts + DB |
| M4 | Personal Pilot ready | §5.B |
| M5 | Practice Pilot ready | §6.A–B |
| M6 | Controlled pilot | SECURITY-LAUNCH-GATE pilot section |
| M7 | Production ready | Gate signed + billing |

---

## 13. Immediate next actions (ordered)

1. **0.1** — Intentional `git add`/`commit` of `docs/` + chosen product files (or split commits: docs vs app).  
2. **0.2** — Implement submit safety.  
3. **0.3** — Privacy copy.  
4. **0.4** — CI workflow.  
5. **0.6** — Document freeze in PR checklist / CONTRIBUTING one-liner.  
6. **0.5 + 0.9** — Cumulative note + accept ADR 0008 direction.  
7. **SALE-01 + PER-01** — Sales hub ↔ app mode wiring.  
8. **Start interviews** — one per day beats zero.  
9. **H1** — HMRC Developer Hub registration.  

---

## 14. One-line completion plan

**Commit the OS and freeze unsafe Practice growth; make demo submit safe and privacy honest; finish the four-audience sales site; polish Personal free-check then add accounts, server drafts and sandbox HMRC; only then rebuild Practice on real tenancy; pilot; then production gate and billing—without ever calling sandbox “done.”**

---

## 15. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Completion plan for web sales + web app; Phase 0 first; aligns Codex 10/10 framework vs reality scoring |
