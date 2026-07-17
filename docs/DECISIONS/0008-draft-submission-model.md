# ADR 0008: Server-owned draft submission model

**Status:** Accepted (direction) — implementation partial (Gate 0 uses double-only; server drafts at Gate 2)  
**Date:** 2026-07-17  
**Deciders:** Lee Hine  

## Context

`/api/submit` historically accepted client-supplied `payloads`. Unsafe if server credentials exist.

## Decision

1. **Gate 0:** Public submit always uses **double/preview** unless `HMRC_ALLOW_LIVE_SUBMIT=1`. Env tokens are not attached by default.  
2. **Gate 2:** Import creates server-side **draft_submission**; submit accepts draft id only; browser cannot invent HMRC body.  
3. Double/preview remains available without credentials.

## Alternatives considered

1. HMAC-signed payloads from import — weaker than server storage  
2. Keep client payloads with live token — rejected  

## Consequences

- Gate 0 demo safe without full persistence  
- Persistence required before pilot live/sandbox OAuth submit  
