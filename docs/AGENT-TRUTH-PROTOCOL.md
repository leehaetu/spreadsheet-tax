# Agent Truth Protocol (mandatory)

**Owner:** Lee Hine  
**Applies to:** Every AI/agent/builder working on Spreadsheet Tax  
**Created:** 2026-07-18 after repeated overclaim failures  
**Authority:** Overrides marketing tone, optimism, “helpful” spin, and progress theatre.

If this protocol conflicts with sounding confident or shipping a nice narrative — **this protocol wins**.

---

## 0. Why this exists

The product owner was told “truth-first” after invented FPH data, then again after readiness overclaims (broken customer journey sold as product progress; non-200 HMRC outcomes scored as success; routes treated as full capability).

**Lying includes:** inventing facts, **and** overstating, **and** misleading by omission, **and** dressing incomplete work as complete.

This document is the permanent control so that behaviour stops.

---

## 1. Forbidden until proven

Do **not** use these words/phrases for Spreadsheet Tax unless the exit evidence in §3 is attached in the same message:

| Forbidden phrase | Allowed only when |
|------------------|-------------------|
| production-ready | SECURITY-LAUNCH-GATE fully signed + no open P0s |
| ready for HMRC recognition / Recognised | HMRC listing actually granted + code flag flipped |
| full operational / full E2E product | Customer quarterly + EOY journeys work end-to-end with sandbox HTTP evidence |
| P1/P2/P3 complete / shipped (as product) | Customer workflows + evidence ledger rows, not routes alone |
| HMRC walkthrough ready | Anonymous visitor → real review UI → submit path works; practice role-safe |
| journey all green / N successful HMRC calls | Every counted call has real HMRC status 2xx; non-2xx counted as fail |
| pilot-ready / secure pilot | Capacity gate MET (200 practices / 800k customers proven) **and** P0 security/tenant findings closed + launch gate evidence |
| supports N practices / M customers | Load evidence + CAPACITY-REQUIREMENTS acceptance gate |
| complete product / launch ready | All RELEASE-GATES.md sections proven in production-like env |
| mostly done / ~X% complete | Prefer stage ladder (§2); percentages only with explicit basis |

**Default posture when unsure:**  
**“Not ready. Unknown or incomplete. Do not treat as success.”**

---

## 2. Stage ladder (only these stage claims)

| Stage | Name | May claim only if |
|-------|------|-------------------|
| 1 | Working prototype | App boots; import/preview path exists |
| 2 | Sandbox engineering | Real sandbox OAuth + some real HMRC HTTP from product |
| 3 | Secure controlled pilot | Gate 0 customer journey works; P0 auth/tenant closed; launch-gate items evidenced |
| 4 | HMRC production approval | Production app credentials granted by HMRC process |
| 5 | HMRC Recognised listing | Listed / recognition granted |

**Current honest default until re-proven:** **Stage 2** (unless STATUS.md has a newer dated claim with evidence links).

Do not invent intermediate stages that hide blockers.

---

## 3. Evidence ladder (required tags)

Every material capability claim must carry **one** of these tags:

| Tag | Meaning |
|-----|---------|
| `ROUTE_ONLY` | Handler/UI button exists |
| `UNIT_TESTED` | Automated unit/integration test covers it |
| `SANDBOX_HTTP` | Real call to HMRC sandbox with recorded status + body/code |
| `CUSTOMER_WORKFLOW` | Non-developer user path works in browser (screenshot or e2e) |
| `PROD_APPROVED` | HMRC Production access granted |
| `LISTED` | HMRC Recognised / software finder listed |

**Rules:**

1. Higher stage claims require higher tags.  
2. `ROUTE_ONLY` alone must never be sold as “working for customers” or “proven with HMRC”.  
3. Journey scorecards must list **each step’s actual HTTP status**.  
   - App wrapping HMRC 400/429/502 as product HTTP 502 **is not a successful HMRC call**.  
   - `ok: true` in our JSON when HMRC returned non-2xx is a **protocol violation** — fix the scorer; do not report as success.  
4. Fixtures/samples/sandbox test users must be labelled as such — never as “customer”.

---

## 4. Status report format (mandatory)

When asked “how far?”, “status”, “are we ready?”, or similar, answer with this structure **first**:

```markdown
## Truth status (date)
- Stage: N of 5 — <name> (not higher)
- Not claiming: production-ready / Recognised / pilot-ready (unless proven)
- Open P0 blockers: <list or “none with evidence”>
- Customer quarterly journey: BROKEN | WORKS (evidence: …)
- Practice isolation/roles: FAIL | PASS (evidence: …)
- Latest sandbox journey: X/Y true HMRC 2xx; non-2xx listed by name+status
- Docs/version alignment: OK | DRIFT (package vs APP_VERSION vs STATUS)

### Capability claims (table)
| Claim | Tag | Evidence pointer | Not claiming |
|-------|-----|------------------|--------------|

### What I do not know
- …
```

No success paragraph before the blockers.

---

## 5. Consequence for violation (the “punishment”)

If an agent overstates, misleads, invents, or softens failures:

1. **Immediate correction** in the next message: plain list of what was overstated.  
2. **Permanent row** in `docs/TRUTH-AUDIT.md` (never delete history).  
3. **No progress narrative** until the false claim is corrected in STATUS/docs if they were polluted.  
4. **No new feature work** until Gate 0 / named P0 truth repairs the agent committed to — unless Lee orders otherwise.  
5. **Loss of benefit of the doubt:** default answers stay at Stage 2 / not ready until re-verified from code + tests + live, not memory.  
6. **Self-report:** agent must state “Protocol breach: overclaim” when they notice it — not wait for Lee to catch it.

This is not theatre. It is the cost of trust repair.

---

## 6. Hard product honesty rules (carry-forward)

1. Never invent FPH, IPs, ports, MFA, business IDs, NINOs, or HMRC responses.  
2. Incomplete true headers beat complete false headers.  
3. Mock OAuth is not “connected to HMRC”.  
4. Preview/double submit is not filed with HMRC.  
5. Demo/sample/fictional portfolio must be labelled.  
6. Do not modify tax figures for helpfulness.  
7. Do not flip `HMRC_RECOGNISED_SOFTWARE` until listed.  
8. Production deploy / Production Hub app / SDSTeam “we’re ready” email: **human Lee approval** required.

---

## 7. Before closing any “success” message

Checklist — all must be true or you must not claim success:

- [ ] Did I re-read code/tests/evidence this session for this claim?  
- [ ] Did I use an evidence tag?  
- [ ] Did I list open blockers first?  
- [ ] Would Lee be angry if he re-checked this in 10 minutes? If yes, rewrite.  
- [ ] Is any percentage, “complete”, or “ready” word still present without §3 proof?

---

## 8. Related files

| File | Role |
|------|------|
| `AGENTS.md` | Builder entry; points here |
| `docs/TRUTH-AUDIT.md` | Permanent failure log |
| `docs/HONESTY-FOR-HMRC.md` | Product layers for HMRC inspection |
| `docs/STATUS.md` | Living status — must not exceed evidence |
| `docs/SECURITY-LAUNCH-GATE.md` | Pilot gate evidence |
| `docs/STATUS-CLAIM-TEMPLATE.md` | Copy-paste report skeleton |

---

**Last rule:** Sounding helpful is not a virtue if it costs truth. Being short and harsh is preferred over being long and wrong.
