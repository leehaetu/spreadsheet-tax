# Agent instructions (builders)

## Source of truth

- **Truth / anti-overclaim (binds all status talk):** `docs/AGENT-TRUTH-PROTOCOL.md`  
- Status claim skeleton: `docs/STATUS-CLAIM-TEMPLATE.md`  
- Permanent failure log: `docs/TRUTH-AUDIT.md`  
- Living status: `docs/STATUS.md` (must not exceed evidence)  
- Complete sales + app: `docs/COMPLETION-PLAN.md`  
- Hub: `docs/ULTIMATE-PRODUCT-PLAN.md`  
- HMRC inspection honesty: `docs/HONESTY-FOR-HMRC.md`  

## Do first

1. Read `docs/AGENT-TRUTH-PROTOCOL.md` before any readiness/progress answer.  
2. Gate 0 safety before new Practice features. One code writer at a time.  
3. Default stage claim: **Stage 2 — Sandbox engineering** until STATUS.md is re-verified with evidence.

## Truth-first (mandatory — overrides cleverness, optimism, and “helpful” spin)

**Lying includes inventing facts, overstating, misleading by omission, and scoring failures as success.**

1. **Only state what is true.** If unknown, say unknown. Prefer short and harsh over long and wrong.  
2. **Never invent data** to pass HMRC (or any) validation: no fake ports, IPs, screens, timezones, MFA, business IDs, NINOs, or “VALID_HEADERS” claims.  
3. **Incomplete true headers beat complete false headers.** Omit and document missing FPH.  
4. **Label modes honestly:** double/preview · mock OAuth · sandbox · live. Never call mock “connected to HMRC”.  
5. **Label data sources honestly:** fixture/sample · sandbox test user · real customer.  
6. **Report exact outcomes:** HTTP status + HMRC code. Non-2xx is a **fail**, not “okish”.  
7. **Do not modify tax figures** for “helpfulness”.  
8. **Evidence tags required** on capability claims: `ROUTE_ONLY` · `UNIT_TESTED` · `SANDBOX_HTTP` · `CUSTOMER_WORKFLOW` · `PROD_APPROVED` · `LISTED`.  
9. **Forbidden without proof:** production-ready · pilot-ready · HMRC Recognised · full operational E2E · journey all green · “P1–P3 complete” as product.  
10. **Status answers** must use `docs/STATUS-CLAIM-TEMPLATE.md` structure (blockers first).  
11. Record **every** material honesty/overclaim failure in `docs/TRUTH-AUDIT.md` (never delete rows).  
12. On breach: immediate correction + audit row + no success narrative until fixed (see protocol §5).  

## Hard rules

1. Never enable live HMRC via env token for anonymous public submit (default double only).  
2. Do not expand unauthenticated Practice writes.  
3. Do not invent HMRC API behaviour; cite official sources.  
4. Do not put NINO/spreadsheet contents in logs or external prompts.  
5. Do not market product as AI-powered.  
6. No language `enum` in product code.  
7. Tax mappings stay deterministic in `src/lib/*` with tests.  
8. After material changes: `npm test`; if UI: `npm run test:e2e`.  
9. Session end: update status **only with evidence tags**; small commits; push branch.  
10. Production deploy requires human approval.  
11. **No synthetic fraud-prevention fields** (see Truth-first).  
12. Do not email SDSTeam / create Production Hub app / claim checklist complete without Lee’s explicit approval.  
13. Do not flip recognised-software UI/code flags until HMRC listing is real.  

## Permitted AI use

Implement, test, review, docs, **clearly labelled** fictional fixtures, official-spec summaries.

## Prohibited AI use

Lying to HMRC or the user; **overclaiming readiness**; inventing FPH/telemetry; autonomous production live submit without human approval; legal sign-off; modifying figures for “helpfulness”; production secrets in chat when avoidable; scoring non-2xx HMRC calls as success.
