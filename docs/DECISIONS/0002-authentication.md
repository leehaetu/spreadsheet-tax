# ADR 0002: Authentication method

**Status:** Accepted (v1)  
**Date:** 2026-07-17  
**Deciders:** Lee Hine  

## Context

Pilot ready requires authenticated users. Free spreadsheet check may remain anonymous; live submit must not.

## Decision

**v1 shipped:** Email + password (scrypt) + HTTP-only `st_session` cookie; SQLite session rows; free check remains anonymous.  
**Later:** MFA for practice admins; optional magic link; hosted auth if ops burden grows.

## Alternatives considered

1. OAuth-only social login — weaker fit for accountants  
2. API keys only — not for end users  

## Consequences

- Session secret required at boot in staging/production  
- Password reset / magic-link email provider dependency  
- Free check path must remain clearly separated  

## Links

- DELIVERY 0.2 · SECURITY-LAUNCH-GATE SEC-01..03  
