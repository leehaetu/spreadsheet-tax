# ADR 0009: Submission idempotency

**Status:** Proposed · **Date:** 2026-07-17 · **Deciders:** Lee Hine  

## Context

Retries can double-submit.

## Decision

_Pending._ Lean: client or server generates `idempotency_key` unique per draft+source; store on `submission_attempts`; replay returns prior result.
