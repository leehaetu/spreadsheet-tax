# ADR 0002: Authentication method

**Status:** Proposed  
**Date:** 2026-07-17  
**Deciders:** Lee Hine  

## Context

Pilot ready requires authenticated users. Free spreadsheet check may remain anonymous; live submit must not.

## Decision

_Pending._ Leading options:

1. **Email magic link** — low friction Personal  
2. **Email + password** — familiar for practices  
3. **Hosted auth (Clerk/Auth.js/etc.)** — faster MFA/session features  

**Proposed lean:** Start with secure session cookies + email magic link or password for pilot; MFA mandatory for practice admins before multi-user production.

## Alternatives considered

1. OAuth-only social login — weaker fit for accountants  
2. API keys only — not for end users  

## Consequences

- Session secret required at boot in staging/production  
- Password reset / magic-link email provider dependency  
- Free check path must remain clearly separated  

## Links

- DELIVERY 0.2 · SECURITY-LAUNCH-GATE SEC-01..03  
