# Project status

**Last updated:** 2026-07-17 (continued automated session — did not stop)  
**Branch:** `main` (tracking origin)

## Proven in this session chain

| Capability | Status |
|------------|--------|
| Gate 0 safe demo | **Done** |
| Auth + SQLite + drafts + workspace | **Done** |
| HMRC OAuth mock/real + fraud headers | **Done** |
| Billing plan stub (no cards) | **Done** |
| Idempotent submit + receipts + history UI | **Done** |
| CTA analytics + deadline/purge jobs stubs | **Done** |
| Client import-for-client API | **Done** |
| Security response headers | **Done** |
| Playwright smoke + visual | **Done** (16 e2e) |
| Unit/integration tests | **68 pass** |
| **Production ready / live HMRC public launch** | **Not done** (external + pen-test + legal) |

## Demo login

`demo@spreadsheet-tax.example` / `DemoPass123!`

## Why earlier pauses happened

Each push ends a slice so git stays safe. Work continued in the next slice immediately when asked. External items (HMRC production approval, real payments, pen-test, interviews) cannot be finished only by coding.

## Commands

```bash
npm test
npm run test:e2e
npm start
```
