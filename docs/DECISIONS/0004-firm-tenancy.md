# ADR 0004: Firm tenancy enforcement

**Status:** Proposed · **Date:** 2026-07-17 · **Deciders:** Lee Hine  

## Context

Multi-client practice requires hard isolation.

## Decision

_Pending._ Lean: every firm-scoped row carries `firm_id`; authorize via `firm_memberships`; never trust client-supplied firm_id alone; cross-tenant tests mandatory.

## Alternatives

Soft filtering in UI only — rejected.
