# ADR 0003: Session storage

**Status:** Proposed · **Date:** 2026-07-17 · **Deciders:** Lee Hine  

## Context

Need short-lived secure sessions for pilot.

## Decision

_Pending._ Lean: HTTP-only Secure SameSite cookies; server-side session store (DB or Redis) rather than large unencrypted JWTs holding authority.

## Alternatives

Stateless JWT only · server sessions in memory (not multi-instance safe)

## Consequences

Sticky sessions or shared store; session secret required at boot.
