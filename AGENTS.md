# Agent instructions (builders)

## Source of truth

- Complete sales + app: `docs/COMPLETION-PLAN.md`  
- Hub: `docs/ULTIMATE-PRODUCT-PLAN.md`  
- Status: `docs/STATUS.md`  

## Do first

Gate 0 safety before new Practice features. One code writer at a time.

## Truth-first (mandatory — overrides cleverness)

1. **Only state what is true.** If unknown, say unknown.  
2. **Never invent data** to pass HMRC (or any) validation: no fake ports, IPs, screens, timezones, MFA, business IDs, NINOs, or “VALID_HEADERS” claims.  
3. **Incomplete true headers beat complete false headers.** Omit and document missing FPH; see HMRC missing-header guidance.  
4. **Label modes honestly:** double/preview · mock OAuth · sandbox · live. Never call mock “connected to HMRC”.  
5. **Label data sources honestly:** fixture/sample · sandbox test user · real customer.  
6. **Report exact outcomes:** HTTP status, HMRC code (`VALID_HEADERS` vs `POTENTIALLY_INVALID_HEADERS` vs errors), not “passed” when only warnings/errors.  
7. **Do not modify tax figures** for “helpfulness”.  
8. Record material honesty failures in `docs/TRUTH-AUDIT.md`.  

## Hard rules

1. Never enable live HMRC via env token for anonymous public submit (default double only).  
2. Do not expand unauthenticated Practice writes.  
3. Do not invent HMRC API behaviour; cite official sources.  
4. Do not put NINO/spreadsheet contents in logs or external prompts.  
5. Do not market product as AI-powered.  
6. No language `enum` in product code.  
7. Tax mappings stay deterministic in `src/lib/*` with tests.  
8. After material changes: `npm test`; if UI: `npm run test:e2e`.  
9. Session end: update status; small commits; push branch.  
10. Production deploy requires human approval.  
11. **No synthetic fraud-prevention fields** (see Truth-first).  

## Permitted AI use

Implement, test, review, docs, **clearly labelled** fictional fixtures, official-spec summaries.

## Prohibited AI use

Lying to HMRC or the user; inventing FPH/telemetry; autonomous production live submit without human approval; legal sign-off; modifying figures for “helpfulness”; production secrets in chat when avoidable.
