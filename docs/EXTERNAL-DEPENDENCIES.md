# External dependencies (HMRC / human)

Items that **cannot** be completed by implementer code alone.

| ID | Dependency | Owner | Status |
|----|------------|-------|--------|
| EXT-1 | HMRC Production application approval | HMRC SDSTeam | **Not submitted** until Lee approves package |
| EXT-2 | Production credentials issued | HMRC | Waiting EXT-1 |
| EXT-3 | Fraud-prevention header review outcome | HMRC | Waiting Production path |
| EXT-4 | HMRC Recognised / software finder listing | HMRC | After Production verified |
| EXT-5 | Human sign-off of SECURITY-LAUNCH-GATE.md | Lee Hine | Open — matrix exists, sign-off required |
| EXT-6 | Controlled pilot with real workflow feedback | Lee + pilot users | Not run |
| EXT-7 | Production Approvals Checklist email to SDSTeam | Lee | Draft exists; send requires Lee |
| EXT-8 | Hub subscribe Individual Losses / TLA if claiming full E2E losses | Lee on Hub | Optional until claimed |
| EXT-9 | Live production OAuth + low-risk live journey | Lee + HMRC after EXT-2 | External |
| EXT-10 | Railway production secrets (TOKEN_ENCRYPTION_KEY distinct, COOKIE_SECURE) | Lee / ops | Configure before NODE_ENV=production |

**Do not** claim these complete in STATUS.md.
