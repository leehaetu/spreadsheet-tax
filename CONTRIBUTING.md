# Contributing (Spreadsheet Tax)

## Commands

```bash
npm install
npm test
npm run test:e2e   # Playwright smoke (starts app automatically)
npm start
```

## Delivery rhythm

1. Implement a small slice  
2. `npm test` (and `npm run test:e2e` if UI)  
3. Update `docs/STATUS.md`  
4. Commit with a clear message  
5. Push branch; open PR (template checklist)  

## Standing rules

- **Practice freeze:** no new unauthenticated write APIs; workflow PATCH requires `DEMO_PRACTICE_WRITES=1`  
- **Submit safety:** live HMRC credentials unused unless `HMRC_ALLOW_LIVE_SUBMIT=1`  
- **Privacy:** period files are uploaded for mapping; ongoing books stay in the user’s spreadsheet  
- **No AI product claims** in customer copy  
- **No language enums** in product source  
- Readiness labels: Demo / Pilot / Production only when gates proven  

## Docs

Start at [docs/README.md](docs/README.md) and [docs/COMPLETION-PLAN.md](docs/COMPLETION-PLAN.md).
