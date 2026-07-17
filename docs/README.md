# Spreadsheet Tax — documentation index

**Master strategy & phases:** [ULTIMATE-PRODUCT-PLAN.md](./ULTIMATE-PRODUCT-PLAN.md)  
**Finish web sales + web app:** [COMPLETION-PLAN.md](./COMPLETION-PLAN.md) ← **execute this**

This folder is the **operating system** for product strategy, delivery, and launch safety.

**Framework is 10/10. Product is not.** The docs correctly leave unproven controls unchecked.  
More strategy prose has diminishing value; **Phase 0 engineering + customer evidence** are the route forward.

Safety and launch readiness cannot honestly be 10/10 until controls are **implemented**, **independently tested**, and **proven in a real pilot**.

## Document map

| Document | Purpose | 10/10 when |
|----------|---------|------------|
| [COMPLETION-PLAN.md](./COMPLETION-PLAN.md) | Complete sales site + Personal/Practice app (M0–M7) | Milestones evidenced |
| [ULTIMATE-PRODUCT-PLAN.md](./ULTIMATE-PRODUCT-PLAN.md) | Direction, offers, phases, standing orders | Hub stays readable |
| [PRODUCT-STRATEGY-EVIDENCE.md](./PRODUCT-STRATEGY-EVIDENCE.md) | ICPs, competitors, pricing evidence | Interviews + paid intent |
| [DELIVERY-OPERATING-PLAN.md](./DELIVERY-OPERATING-PLAN.md) | Owned backlog, Phase 0 records, envs | Owners, dates, CI, Phase 0 done |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | As-is / to-be, ADR index | ADRs accepted |
| [DATA-MODEL.md](./DATA-MODEL.md) | Tenant-scoped schema | Approved + migrated |
| [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md) | **Only** H1–H13 checklist (no dup in hub) | Sandbox + production path |
| [HMRC-PRODUCTION-ACCESS.md](./HMRC-PRODUCTION-ACCESS.md) | Hub Production app + SDSTeam evidence pack | Operator steps for Production APIs |
| [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md) | Requirement → evidence → go/no-go | All mandatory proven |
| [COMPLIANCE-REGISTER.md](./COMPLIANCE-REGISTER.md) | Privacy, legal, retention | Launch pack complete |
| [DECISIONS/](./DECISIONS/) | ADRs | Early ADRs decided |
| [RUNBOOKS/](./RUNBOOKS/) | Incident, restore, HMRC expiry, support | Tested once |

## Scoring honesty (aligned with Codex)

| Area | Framework | Current reality |
|------|-----------|-----------------|
| Product strategy | 10/10 structure | ~7/10 until evidence |
| Executable delivery | 10/10 OS | ~7/10 until Phase 0 + owners/dates |
| Safety & launch | 10/10 gate design | ~3–4/10 until auth/OAuth/tenancy/parser |

## Immediate route

1. **Commit `docs/` + intentional product WIP** (0.1)  
2. Block anonymous credentialed HMRC submit (0.2)  
3. Fix privacy claims (0.3)  
4. Add CI (0.4)  
5. Freeze writable professional APIs (0.6)  
6. Cumulative-update note (0.5)  
7. Approve first ADRs + data model (0.9)  
8. Then sales complete + Personal demo/pilot per [COMPLETION-PLAN.md](./COMPLETION-PLAN.md)  
