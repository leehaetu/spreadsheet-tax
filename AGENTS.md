# Agent instructions (builders)

## Source of truth

- Complete sales + app: `docs/COMPLETION-PLAN.md`  
- Hub: `docs/ULTIMATE-PRODUCT-PLAN.md`  
- Status: `docs/STATUS.md`  

## Do first

Gate 0 safety before new Practice features. One code writer at a time.

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

## Permitted AI use

Implement, test, review, docs, fictional fixtures, official-spec summaries.

## Prohibited AI use

Autonomous live submit, legal sign-off, modifying figures for “helpfulness”, production secrets.
