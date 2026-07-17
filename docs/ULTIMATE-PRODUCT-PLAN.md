# Spreadsheet Tax — Ultimate Product Plan

**Status:** Master direction hub · v1.2  
**Overall owner:** Lee Hine  
**IP:** All product IP, including modifications and improvements, belongs to Lee Hine  
**License model:** Companies may be licensed to sell subscriptions to their customers under written agreement  
**Policy:** No AI product claims · no language enumerations in product code · customer-facing copy only  

This file stays **readable**. Execution, evidence, and launch proof live in linked operating documents ([docs/README.md](./README.md)).

| Score dimension | Plan/docs quality | 10/10 proven when |
|-----------------|-------------------|-------------------|
| Product strategy | Strong direction | [PRODUCT-STRATEGY-EVIDENCE.md](./PRODUCT-STRATEGY-EVIDENCE.md) validation gate |
| Executable delivery | Strong phases | [DELIVERY-OPERATING-PLAN.md](./DELIVERY-OPERATING-PLAN.md) proof gate + Phase 0 done |
| Safety & launch | Strong checklists | [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md) all mandatory proven + pilot |

**A plan can be 10/10 before launch. Safety and launch readiness cannot honestly be 10/10 until controls are implemented, independently tested, and proven in a real pilot.**

### Operating system (linked docs)

| Doc | Role |
|-----|------|
| [PRODUCT-STRATEGY-EVIDENCE.md](./PRODUCT-STRATEGY-EVIDENCE.md) | ICPs, jobs, competitors, pricing evidence, strategy gate |
| [DELIVERY-OPERATING-PLAN.md](./DELIVERY-OPERATING-PLAN.md) | Owned backlog, environments, capacity, Phase 0 records |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-is / to-be, ADR index |
| [DATA-MODEL.md](./DATA-MODEL.md) | Authoritative schema |
| [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md) | Registration, OAuth, fraud headers, conformance |
| [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md) | Requirement → evidence → go/no-go |
| [COMPLIANCE-REGISTER.md](./COMPLIANCE-REGISTER.md) | Privacy, legal, retention, subprocessors |
| [DECISIONS/](./DECISIONS/) | ADRs |
| [RUNBOOKS/](./RUNBOOKS/) | Incident, restore, HMRC expiry, support |

### Route to 10/10 (immediate)

1. Complete Phase 0 safety ([DELIVERY-OPERATING-PLAN.md](./DELIVERY-OPERATING-PLAN.md) §4)  
2. Approve data model + key ADRs  
3. Own and date the next 30 days  
4. Start customer interviews ([PRODUCT-STRATEGY-EVIDENCE.md](./PRODUCT-STRATEGY-EVIDENCE.md))  
5. Start HMRC registration/sandbox ([HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md))  
6. Fill launch matrix evidence ([SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md))  
7. **Freeze production launch** until mandatory gates are proven  

**To complete web sales + web app end-to-end:** follow **[COMPLETION-PLAN.md](./COMPLETION-PLAN.md)** (milestones M0–M7). Do not expand this hub into a second backlog.

**HMRC checklist:** maintain only in [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md) (avoid duplicate H1–H13 lists drifting).

---

## 0. Standing order (read first)

**Do not add more visible practice features or writable professional operations until Phase 0 safety and Phase 4 identity/tenancy are underway.**

| Now | Later |
|-----|--------|
| Freeze additional practice APIs and workflow writes | Resume Practice build on authenticated tenancy |
| Execute Phase 0 immediately | Expand sales/personal after safety |
| Start persistent data + identity design | Full workspace UI on real records |

In-memory practice workflow is a **demo**, not a product. Public writable client APIs must not grow further while unauthenticated.

---

## 1. North star

Turn Spreadsheet Tax into:

1. **A production-ready, high-converting sales website** aimed at maximum sales  
2. **A spreadsheet-first MTD bridging platform** with **separate experiences**:
   - Taxpayers (self-employed + landlords) — calm, guided, plain English  
   - Accountancy professionals (bookkeepers, accountants, firms) — dense, controlled, workflow-led  

**Central promise**

> Keep using your spreadsheet. Review your figures clearly. Send your MTD updates with confidence.

**Supporting promises**

- No need to replace the spreadsheet that already works  
- Built for self-employment and property income (UK and foreign)  
- Clear review before anything is submitted  
- Visible digital links and submission evidence  
- Professional tools for managing multiple clients  
- Company license path for firms that sell subscriptions to their customers  

---

## 2. Readiness states (do not conflate)

Never describe a lower state as “the product is complete.”

| State | Meaning | Allowed claims | Exit evidence |
|-------|---------|----------------|---------------|
| **Demo complete** | Safe sample, upload, review, preview/double submit | “Try the spreadsheet check” · “See how mapping works” | Anonymous cannot use live HMRC token · privacy copy accurate · core journey works in double/sandbox without fake production claims |
| **Pilot ready** | Authenticated users; persistent records; sandbox HMRC | “Closed pilot” · “Sandbox submissions for invited users” | Auth + tenancy · import sessions server-side · audit of submissions · sandbox journey unaided · no public client enumeration |
| **Production ready** | Live HMRC (approved), billing, monitoring, support, full compliance | Public paid product · firm licenses | Phase 4 gate passed · HMRC production approval · fraud headers · billing · support runbooks · legal pack · pilot sign-off |

### Journey targets by state

| Audience | Demo complete | Pilot ready | Production ready |
|----------|---------------|-------------|------------------|
| Self-employed / landlord | Free check → review → double/sandbox preview | Account → sandbox submit → receipt → history | Live submit · deadlines · support · paid plan |
| Bookkeeper / accountant | View demo portfolio (read-only preferred) | Authenticated client book · import for client · sandbox | Live agent/individual authority · full workflow |
| Multi-user firm | Marketing only / static demo | 1–2 pilot firms · isolation | Seats · license · reports · resale under agreement |
| Operator | CI · risk register · no open live token | Secrets · monitoring · sandbox OAuth | Full compliance gate (§7, Phase 4) |

---

## 3. Commercial structure (how we sell)

**One brand. Three offers. Two app shells.**

| Offer | Audience | Experience | App shell |
|-------|----------|------------|-----------|
| **Spreadsheet Tax Personal** | Self-employed people and landlords | Simple, reassuring, plain English | Personal app |
| **Spreadsheet Tax Professional** | Bookkeepers and sole accountants | Efficient, precise, workflow-focused | Practice workspace |
| **Spreadsheet Tax Practice** | Accountancy firms (multi-user) | Controlled, scalable, multi-client | Practice workspace + team/admin |

**Rule:** Visitors choose their route early. Do not mix sole-trader language with firm-management features on the same sales journey.

### Packages (names lock early; prices stay experimental)

| Package | Who | Primary CTA | Price status |
|---------|-----|-------------|--------------|
| Personal Self-Employed | Sole traders / trades | Check my spreadsheet | **Hypothesis** until buyer evidence |
| Personal Landlord | UK and/or foreign property | Start my property update | **Hypothesis** |
| Personal Combined | Trade + property | Check my spreadsheet | **Hypothesis** |
| Professional | Bookkeeper / accountant | See the accountant workspace | **Hypothesis** |
| Practice | Multi-user firm | Book a practice demonstration / License for your firm | **Hypothesis** |

### Phase 0 commercial decisions (structure only)

Lock **structure** early; do **not** freeze final prices without evidence:

- [ ] Package **names** and primary CTAs (lock)  
- [ ] Free trial vs free spreadsheet check → **recommend: free check without account; account + HMRC required for live submit**  
- [ ] Professional metric hypothesis: per user / per client / per practice (hypothesis)  
- [ ] Practice seats / client caps / portal included (hypothesis)  
- [ ] Support level sketch per plan (hypothesis)  
- [ ] Refund and cancellation draft (draft)  
- [ ] Company license / resale outline — IP remains Lee Hine (legal draft)  

### Customer evidence before locking prices (Phase 0–1 validation)

| Activity | Target |
|----------|--------|
| Self-employed interviews | 5 |
| Landlord interviews | 5 |
| Practitioner interviews | 5 |
| Firm interviews | 2 |
| Price-sensitivity questions | All interviews |
| Current software + switching-cost research | Summary note |
| Paid-intent test or refundable pilot deposit | Optional after Demo complete |

**Rule:** Package names may lock in Phase 0. **Numeric pricing remains experimental** until interviews and/or paid-intent tests react. Revise packaging only with evidence, not gut feel alone.

---

## 4. Product architecture

### Engineering shells (build once)

```
┌─────────────────────────────────────────────────────────┐
│                    SALES WEBSITE                          │
│  Hub · SE · Landlords · Professionals · Firms · Pricing │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
                ▼                     ▼
┌───────────────────────┐   ┌─────────────────────────────┐
│   PERSONAL APP        │   │   PRACTICE WORKSPACE          │
│   Spreadsheet mode    │   │   Accountancy mode            │
│   /app …              │   │   /workspace …                │
└───────────┬───────────┘   └──────────────┬────────────────┘
            │                              │
            └──────────────┬───────────────┘
                           ▼
            ┌──────────────────────────────┐
            │  SHARED BRIDGING ENGINE        │
            │  parse → map → validate →      │
            │  payload → HMRC → audit        │
            └──────────────────────────────┘
```

### Information architecture (target)

**Sales:** `/` · `/self-employed` · `/landlords` · `/professionals` · `/firms` · `/how-it-works` · `/pricing` · `/templates` · `/security` · `/help` · `/license` · `/legal` · `/signin` · `/start`

**Personal app:** `/app` · mode presets · `/app/history` · `/app/connect-hmrc`

**Practice workspace** (after auth; evolve from `/accountant` + `/practice`):  
`/workspace` · clients · updates · imports · review · submissions · exceptions · team · reports · settings · billing · `/portal` (invited)

### UX contrast (design test)

| Dimension | Personal | Professional / Practice |
|-----------|----------|-------------------------|
| First screen | Upload / check spreadsheet | Client portfolio / dashboard |
| Density | Generous, large controls | Compact tables, filters |
| Language | Money received, business expenses | Client, assignee, period, approval |
| Success | Update accepted + receipt | Client moved to Submitted |
| Navigation | Linear wizard | Sidebar ops nav |
| Primary CTA from sales | Check my spreadsheet | See workspace / Book demo |

**Design system:** one foundation, two modes (Personal generous / Professional dense).

---

## 5. Persistent data model (Phase 4 deliverable — design early)

Define and implement these records **before** expanding workspace features. Affects almost every subsequent feature.

| Record | Purpose |
|--------|---------|
| **User** | Identity, credentials, contact |
| **Firm** | Practice tenancy boundary |
| **FirmMembership** | User ↔ firm, role (string constants) |
| **Client** | Taxpayer/client under a firm (or self for Personal) |
| **Business** / **IncomeSource** | SE trade, UK property, foreign property instances |
| **TaxPeriod** | Tax year + period bounds; cumulative rule link |
| **Import** | Uploaded file metadata, hash, retention policy |
| **MappingProfile** | Saved column/field mappings (user or client) |
| **ValidationResult** | Errors/warnings snapshot for an import |
| **DraftSubmission** | Server-owned payload + figures (source of truth) |
| **HmrcConnection** | OAuth tokens, env, scopes, expiry, agent vs individual |
| **SubmissionAttempt** | Idempotency key, request/response, status |
| **Receipt** | User-facing confirmation artefact |
| **WorkflowEvent** | Status transitions, assignee changes |
| **AuditEvent** | Immutable who/what/when for compliance |
| **Subscription** / **Entitlement** | Plan, seats, firm license, resale flags |

**Integrity rule:** Live and pilot submit uses **DraftSubmission** (and linked Import) on the server. The browser may not invent the HMRC body.

---

## 6. HMRC onboarding workstream (critical path)

Treat as a **named workstream**, not only “engineering in Phase 4.”

**Single source of checklist items H1–H13, scopes, fraud headers, and evidence:**  
→ **[HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md)**  
→ Revoked/expired authority runbook: [RUNBOOKS/hmrc-authority-expiry.md](./RUNBOOKS/hmrc-authority-expiry.md)

**This workstream runs in parallel from Phase 0 and is a hard dependency for Production ready.**

---

## 7. Delivery phases

```
Phase 0  Safe foundation + commercial structure     [~1 week]
Phase 1  Positioning, packages, customer evidence   [1–2 weeks]
Phase 2  High-converting sales website              [2–4 weeks]
Phase 3  Personal spreadsheet experience            [4–7 weeks]
Phase 4  Production foundation + data model + HMRC  [parallel; hard gate 4–8 weeks]
Phase 5  Professional + Practice workspace           [5–9 weeks, after auth/tenancy]
Phase 6  Design system codify                       [ongoing + focused pass]
Phase 7  Quality, pilot, launch readiness           [2–4 weeks]
Phase 8  Billing, commercial launch, optimisation   [ongoing]
```

```
Phase 0 ──► Phase 1 ──► Phase 2
    │                      │
    │                      └──► Phase 3 Personal ──┐
    │                                │             │
    └──► Phase 4 Production ◄────────┘             │
    └──► HMRC workstream ──────────────────────────┤
              │                                    │
              └──► Phase 5 Practice ───────────────┤
                        └──► Phase 6 · 7 · 8 ◄─────┘
```

---

### Phase 0 — Safe foundation + commercial structure  
**Time:** ~1 week  
**Goal:** Demo complete path is safe; packages named; practice freeze enforced.

| # | Work | R | A | Done when |
|---|------|---|---|-----------|
| 0.1 | Intentional review + commit of dirty worktree (or explicit discard) | Eng | Lee | Clean intentional baseline on main or release branch |
| 0.2 | Prevent anonymous use of any HMRC credential / open live submit | Eng | Lee | No unauthenticated live token path |
| 0.3 | Correct every “records stay local” / equivalent claim | Sales copy | Lee | Accurate privacy wording site-wide + API |
| 0.4 | Add CI (`npm test` on push) | Eng | Lee | Green pipeline |
| 0.5 | Document cumulative-update decision (stub OK if “pending research”) | Domain | Lee | Decision note in `docs/` |
| 0.6 | Freeze writable professional APIs / no new practice features | Eng | Lee | Standing order enforced in PRs |
| 0.7 | Lock package **names** + CTAs (not final prices) | Product | Lee | Table §3 updated |
| 0.8 | Risk register live (§9) | Product | Lee | This doc or tracker |
| 0.9 | Start identity + persistent data model design spike | Eng | Lee | Draft schema from §5 |

**Exit gate:** Demo complete safety · package names locked · practice freeze · CI · cumulative note · data-model spike started.

---

### Phase 1 — Positioning and customer evidence  
**Time:** 1–2 weeks  

| # | Work |
|---|------|
| 1.1 | Messaging matrix per audience page |
| 1.2 | Pricing **hypotheses** only (ranges OK) |
| 1.3 | Run interview set (§3 evidence table) |
| 1.4 | Lead magnet list finalised |
| 1.5 | Support / refund / cancellation drafts |
| 1.6 | Revise packages only if interviews demand it |

**Exit gate:** Each audience has one problem, promise, price **hypothesis**, primary CTA; interview notes stored.

---

### Phase 2 — High-converting sales website  
**Time:** 2–4 weeks  

#### Site map

Home · Self-Employed · Landlords · Bookkeepers & Accountants · Accountancy Firms · How It Works · Pricing · Spreadsheet Templates · Security & HMRC · Help Centre · License · Sign In · Start Free

#### Homepage sequence

Outcome headline → route selector → upload/review/submit → screenshots → spreadsheet benefits → trust → use cases → pricing preview → FAQ → final CTA.

#### Conversion system

| Primary CTAs | Lead magnets |
|--------------|--------------|
| Check my spreadsheet | Free MTD spreadsheet template |
| Start my quarterly update | Free spreadsheet compatibility checker |
| See the accountant workspace | MTD readiness checklist |
| Book a practice demonstration | Landlord quarterly-update guide |
| License for your firm | Accountant client-migration toolkit |

#### Measurable sales exit gates (initial targets)

| Metric | Initial target | How measured |
|--------|----------------|--------------|
| Correct product explanation after 10s | ≥ 70% of moderated test participants | 5–10 user tests |
| Appropriate audience route unaided | ≥ 60% | Same tests / first-click |
| Template download CTR (from SE/landlord pages) | Baseline then improve | Analytics |
| Spreadsheet-check start rate (CTA → `/app` import started) | Baseline then improve | Analytics |
| Pricing → start conversion | Baseline then improve | Analytics |
| Practice demo request rate | Baseline then improve | Form submissions |

Revise targets after real traffic. “Ten seconds” is qualitative; the table above is the proof.

**Exit gate:** Targets measured at least once in moderated tests; analytics events instrumented for CTAs.

**Repo baseline:** audience pages started; deepen to full conversion standard; add missing map pages.

---

### Phase 3 — Personal spreadsheet experience  
**Time:** 4–7 weeks  
**Maps to:** Demo complete → Pilot ready for individuals  

#### Core journey

```text
[Optional free check] → Create account → Choose SE / property / both
  → Connect HMRC (required for live) → Download template or upload
  → Map columns (saved) → Review income & expenses → Resolve warnings
  → Confirm declaration → Submit → Receipt + next deadline
```

**Hybrid conversion:** upload/review before account; account + HMRC for live submit.

#### Essential features

| Feature | Priority | State |
|---------|----------|--------|
| Guided setup, plain language | P0 | Partial |
| Drag-and-drop CSV/XLSX | P0 | Exists |
| Readiness validation + block errors | P0 | Exists |
| Human-readable totals | P0 | Partial |
| Samples by audience | P0 | Exists |
| Server import session; locked submit | P0 | **Todo** |
| Draft / ready / submitted | P1 | Todo |
| Downloadable receipt | P1 | Todo |
| Reusable column mapping | P1 | Todo |
| Multi business/property | P1 | Todo |
| History, corrections, deadlines | P1–P2 | Todo |

**Exit gate (Pilot personal):** first-time user completes **valid authenticated sandbox submission** without assistance, with server-owned draft and receipt.

---

### Phase 4 — Production foundation + data model + compliance  
**Time:** 4–8 weeks (start after Phase 0; hard gate before Production ready / multi-tenant pilot)  

#### Technical / security

| Area | Requirements |
|------|----------------|
| Identity | Auth, secure sessions |
| Tenancy | Firm, team, client isolation |
| AuthZ | Role-based permissions (string roles) |
| Data model | Full §5 schema implemented or migrated |
| HMRC | Workstream §6; per-user/firm OAuth |
| Headers | Fraud-prevention headers |
| Integrity | Server-side drafts; no client-authored body as truth |
| Files | Secure parse; replace/isolate vulnerable `xlsx` |
| Ops | Encryption, secrets, rate limits, monitoring |
| Audit | Immutable trail; idempotency; duplicate prevention |
| Safety | No example NINOs/IDs outside test mode |
| Resilience | Backups, DR, production-safe errors |

#### Legal / privacy / operational compliance (launch gate)

| Item | Notes |
|------|--------|
| UK GDPR lawful basis | Documented |
| Privacy notice | Public |
| Cookie policy | If analytics/cookies used |
| Data-processing agreements | Where processors used |
| Data retention schedule | Imports, tokens, logs |
| Subject-access and deletion procedures | Runbooks |
| Subprocessor register | Hosting, email, billing, etc. |
| Incident-response responsibilities | Named roles |
| Terms of service | Public |
| Professional-indemnity / cyber-insurance review | Decision recorded |
| Accessibility target | Prefer **WCAG 2.2 AA** |
| Accountant/agent authority + client-consent evidence | Before agent submit |

**Exit gate:** Security checklist + HMRC sandbox coverage + legal/ops pack + data model live. Independent review recommended before Production ready.

---

### Phase 5 — Professional and Practice workspace  
**Time:** 5–9 weeks  
**Requires:** Phase 4 auth/tenancy and §5 data model underway  
**Rule:** No expansion of **public unauthenticated** practice writes.

#### Navigation

Dashboard · Clients · Quarterly Updates · Imports · Review Queue · Submissions · Exceptions · Team · Reports · Settings · Billing

#### Status model

```text
Awaiting records → Records received → Mapping required → Needs review
  → Client query → Ready for approval → Ready to submit
  → Submitted → Rejected → Correction required
```

#### Features (summary)

Client portfolio, filters, import-for-client, saved mappings, review/approval, preparer/reviewer split, portal, audit, HMRC status, assignment (Practice), reports, multi-firm isolation, seats/license/resale under Lee Hine agreement.

**Exit gate:** Accountant identifies every client needing action and completes common tasks in workspace (not only personal wizard), on **persistent authenticated data**.

**Repo baseline:** in-memory workflow is demo only; re-implement on real tenancy — do not keep growing the public demo API.

---

### Phase 6 — Design system  

One system, two modes. Mobile web first. Native shells secondary until web journeys proven.

---

### Phase 7 — Quality, pilot, launch readiness  

**Tests:** realistic files · SE/UK/foreign · multi business · cumulative rules · corrections · HMRC rejection/expiry · cross-firm access · a11y · browsers · large portfolios · restore/incident drills  

**Pilot sizes:** 10–20 SE · 10–20 landlords · 3–5 practitioners · 1–2 multi-user practices  

**Exit:** Pilot at **Pilot ready**; go/no-go for Production ready.

---

### Phase 8 — Billing, launch, optimisation  

Funnel: landing → audience → pricing → account → HMRC → upload → mapping → first submission → trial paid → renew → invite client  

KPIs: conversion rates, time to first success, retention, clients per pro, CAC/payback  

Experiments on offer/headline/trial/pricing — **never** on security/compliance language  

Billing: Personal subs · Professional · Practice license (+ resale rights under agreement)

---

## 8. Operating system (ownership and dependencies)

Use this table for every significant work item (copy into tracker if preferred).

| Field | Meaning |
|-------|---------|
| **ID** | e.g. 0.2, H8, R1 |
| **Responsible (R)** | Does the work |
| **Accountable (A)** | Decision owner (default: Lee Hine) |
| **External dependency** | HMRC, counsel, insurer, host, payment provider |
| **Evidence** | What proves done |
| **Target date** | ISO date |
| **Status** | not_started · in_progress · blocked · done |
| **Blocked by** | Other IDs |

### Default accountability

| Domain | Accountable |
|--------|-------------|
| Product / commercial / IP | Lee Hine |
| Engineering delivery | Lee Hine (or named eng lead) |
| HMRC registration / production approval | Lee Hine + HMRC Hub |
| Legal / privacy pack | Lee Hine + counsel where needed |
| Security review sign-off | Lee Hine (+ external reviewer if engaged) |

### Critical path (blocking relationships)

```
0.2 submit safety ──► any sandbox with secrets
0.6 practice freeze ──► Phase 5
§5 data model ──► Phase 5 features
§6 HMRC H1–H9 ──► Production ready
Phase 4 auth/tenancy ──► Pilot ready (multi-user)
Phase 4 + billing ──► Production ready commercial
Customer evidence ──► locked public pricing
```

---

## 9. Risk register

| ID | Severity | Risk | Mitigation |
|----|----------|------|------------|
| R1 | Critical | Open `/api/submit` + client payloads + server token | Phase 0, 4 |
| R2 | Critical | No per-user HMRC OAuth | Phase 4, §6 |
| R3 | Critical | HMRC production approval or credentials delay | §6 early start; buffer launch |
| R4 | Critical | Incorrect cumulative-update interpretation | 0.5, tests, domain review |
| R5 | Critical | Tenant data leakage (queries, exports, IDs) | Phase 4 tenancy tests |
| R6 | Critical | Loss/duplication of submissions on retry | Idempotency keys, Phase 4 |
| R7 | High | `xlsx` vulns on untrusted upload | Phase 4 replace/isolate |
| R8 | High | Missing fraud-prevention headers | §6 H8 |
| R9 | High | Public firm/client APIs | Freeze 0.6; Phase 4 auth |
| R10 | High | Misleading “records stay local” | Phase 0.3, 2 |
| R11 | High | Insufficient client approval evidence before agent submit | Phase 4 consent model |
| R12 | High | Spreadsheet formula/date/locale misreads | Parser tests, Phase 3–4 |
| R13 | High | Support demand around deadlines | Support tiers, Phase 8 capacity |
| R14 | High | Pricing fails to cover support + compliance | Evidence-based pricing §3 |
| R15 | Medium | Placeholder NINO/IDs outside test | Phase 4 |
| R16 | Medium | CSV multiline quoted fields | Phase 3–4 |
| R17 | Medium | Practice demo mistaken for product | Freeze; readiness states §2 |
| R18 | Medium | Billing entitlement + company-resale complexity | Phase 8 design; legal |
| R19 | Medium | Single hosting provider dependence (e.g. Railway) | Backup/export; DR note |

---

## 10. Current repo baseline

| Area | State |
|------|--------|
| Bridging pipeline | Strong, tested |
| Audience landing pages | Started |
| Personal wizard + samples + validation | Started |
| Practice workflow statuses | **Demo / in-memory — freeze expansion** |
| Auth, tenancy, OAuth, fraud headers, data model | Not done |
| Billing | Not done |
| Full sales map | Partial |
| Mobile | WebView shell |
| Tests | 53+ passing |

---

## 11. Immediate next 10 working days

| Day | Focus | Output | State toward |
|-----|--------|--------|--------------|
| 1 | 0.1–0.3 | Intentional commit; no anonymous HMRC credential use; privacy copy fixed | Demo complete safety |
| 2 | 0.4–0.6, 0.8 | CI; practice freeze in PR rules; risk register | Demo complete |
| 3 | 0.5, 0.7, 0.9 | Cumulative note; package names; data-model draft | — |
| 4–5 | Phase 1 | Messaging matrix; start interviews | — |
| 6–7 | Phase 2 | Conversion-grade segment pages; analytics events | — |
| 8–9 | Phase 4 start | Auth + schema spike; HMRC H1–H2 if not done | Pilot path |
| 10 | Checkpoint | Confirm freeze held; 30-day scope; readiness label = Demo complete only | — |

**Explicit non-work this sprint:** new writable practice features, public workflow expansion, live HMRC with shared token, final public price list without interviews.

---

## 12. Working rules

1. Every PR labels: **Sales | Personal | Practice | Engine | Compliance | HMRC**.  
2. Reject UI that mixes Personal wizard chrome with Practice grids as default home.  
3. No live HMRC credentials where write APIs are anonymous.  
4. **No new Practice writes until auth + tenancy.**  
5. Sales claims must match readiness state (§2).  
6. IP and derivatives remain Lee Hine; resale only under license.  
7. No AI marketing claims; no language `enum` in product source.  
8. Use readiness labels in all external communication (Demo / Pilot / Production).  
9. Prices stay experimental until evidence (§3).  

---

## 13. Success scorecard

| Horizon | Success |
|---------|---------|
| 2 weeks | **Demo complete** + package names + freeze held + conversion pages improving |
| 6–8 weeks | Personal **Pilot ready** path underway; auth + data model real |
| 12–16 weeks | Practice on tenancy; closed pilot running |
| Launch | **Production ready** gate; billing; funnel instrumented |

---

## 14. One-sentence plan

**Name the packages and freeze unsafe practice growth, make the demo honestly safe, convert each audience through a dedicated sales path into either a calm Personal spreadsheet journey or an authenticated Practice workspace, power both with one bridging engine and a real data model, complete the HMRC and compliance workstreams as a launch gate—not polish—then pilot, bill, and optimise for sales without ever calling sandbox “done.”**

---

## 15. Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-07-17 | Combined pathway + Codex + security + baseline |
| 1.1 | 2026-07-17 | Readiness states, HMRC workstream, pricing evidence, sales metrics, data model, legal, RACI, risks, practice freeze |
| 1.2 | 2026-07-17 | Operating system: linked strategy evidence, delivery OS, architecture, data model, HMRC, security gate, compliance, ADRs, runbooks; honest 10/10 scoring |
| 1.3 | 2026-07-17 | Link COMPLETION-PLAN; dedupe HMRC list to HMRC-WORKSTREAM only |

**Supersedes:** `docs/PRODUCT-PATHWAY.md` (pointer only).  
**Hub document** for direction; **operating system** lives in sibling files under `docs/`.
