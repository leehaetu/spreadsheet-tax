## Summary

<!-- What changed and why -->

## Track (check one or more)

- [ ] Sales
- [ ] Personal app
- [ ] Practice (must respect freeze)
- [ ] Engine / HMRC
- [ ] Compliance / docs
- [ ] CI / tests

## Checklist

- [ ] `npm test` passes locally
- [ ] Playwright smoke passes if UI/routes changed (`npm run test:e2e`)
- [ ] No new unauthenticated Practice **write** APIs
- [ ] No misleading “records never leave device” claims
- [ ] No AI product marketing claims
- [ ] No language `enum` constructs in product source
- [ ] Status / readiness claim not inflated (Demo / Pilot / Production)
- [ ] If HMRC/credentials touched: security note in PR body

## Gate impact

- [ ] Gate 0 only
- [ ] Gate 1 architecture
- [ ] Gate 2 pilot
- [ ] Gate 3 production (requires go/no-go)
