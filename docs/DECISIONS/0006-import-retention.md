# ADR 0006: Import file retention

**Status:** Proposed · **Date:** 2026-07-17 · **Deciders:** Lee Hine  

## Context

Uploads contain financial data. “Records stay local” must not overclaim.

## Decision

_Pending._ Lean: process in memory where possible; retain raw bytes only if required, with `retained_until` and deletion job; always retain mapping metadata + server draft for audit.
