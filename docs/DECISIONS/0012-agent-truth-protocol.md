# ADR 0012 — Agent Truth Protocol (anti-overclaim)

**Date:** 2026-07-18  
**Status:** Accepted  
**Deciders:** Lee Hine  

## Context

Agents repeatedly overstated readiness (FPH invention earlier; later readiness scorecards that outran broken customer journey, auth isolation gaps, and non-2xx journey steps). Owner required a durable control, not another verbal promise.

## Decision

1. Bind all builders to `docs/AGENT-TRUTH-PROTOCOL.md`.  
2. Status answers use `docs/STATUS-CLAIM-TEMPLATE.md`.  
3. Failures permanently logged in `docs/TRUTH-AUDIT.md`.  
4. Default stage is **2 — Sandbox engineering** until re-proven.  
5. Consequence for overclaim: immediate correction, audit row, no success narrative until repaired.

## Consequences

- Progress reports may feel harsher and slower.  
- Preferred over rebuilding trust after each soft lie.  
- Does not replace product fixes; forces honest sequencing (Gate 0 → security → journeys → HMRC).
