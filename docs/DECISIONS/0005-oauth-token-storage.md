# ADR 0005: OAuth token storage and encryption

**Status:** Proposed · **Date:** 2026-07-17 · **Deciders:** Lee Hine  

## Context

HMRC tokens are high-value secrets.

## Decision

_Pending._ Lean: encrypt tokens at rest (app-level key or KMS); never log tokens; revoke deletes ciphertext; separate sandbox vs production rows.
