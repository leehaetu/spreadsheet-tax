# ADR 0011: Cumulative quarterly updates (status)

**Status:** Pending research (owner: Lee Hine)  
**Date:** 2026-07-17  

## Context

HMRC MTD ITSA quarterly updates are commonly described as cumulative from the start of the tax year. The app currently maps a **period file** with explicit `period_start` / `period_end` and builds period-summary style payloads.

## Decision (interim)

1. **Until official conformance is documented**, treat uploaded figures as **what the user put in the period file** and map them to HMRC period-summary shapes without inventing year-to-date rollups.  
2. **Do not claim** full cumulative-update conformance in sales copy until H12 evidence exists.  
3. Owner will complete a dated review of current HMRC Developer Hub / GOV.UK guidance and update this ADR to **Accepted** with explicit product behaviour.

## Alternatives

- Auto-sum prior quarters (rejected until rules proven)  
- Block all property/SE submit until cumulative implemented (too harsh for demo)

## Consequences

- Gate 0 demo can proceed safely  
- Gate 2–3 require this ADR to leave “Pending research”  
- Tests should document intended behaviour when decision lands  

## Sources to review (official only)

- HMRC Developer Hub MTD ITSA APIs  
- GOV.UK Making Tax Digital for Income Tax guidance  
