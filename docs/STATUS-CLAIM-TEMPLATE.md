# Status claim template (copy every time)

Use this when reporting progress, readiness, HMRC path, or “how far”.

```markdown
## Truth status (YYYY-MM-DD)
- Stage: 2 of 5 — Sandbox engineering
- Not claiming: production-ready · pilot-ready · HMRC Recognised · full E2E product
- Open P0 blockers:
  - …
- Customer quarterly journey: BROKEN | WORKS — evidence: …
- Practice isolation/roles: FAIL | PASS — evidence: …
- Latest sandbox journey: ?/? true HMRC 2xx
  - Non-2xx: name → status → HMRC code
- Version: server APP_VERSION=… · package.json=… · STATUS.md=…

### Capabilities
| Claim | Tag (ROUTE_ONLY / UNIT_TESTED / SANDBOX_HTTP / CUSTOMER_WORKFLOW / PROD_APPROVED / LISTED) | Evidence | Explicitly not claiming |
|-------|-------------------------------------------------------------------------------------------|----------|-------------------------|
| … | … | … | … |

### What is unknown
- …

### Next honest step (one)
- …
```

Protocol: `docs/AGENT-TRUTH-PROTOCOL.md`
