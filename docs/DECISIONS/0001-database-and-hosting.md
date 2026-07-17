# ADR 0001: Database and hosting

**Status:** Proposed  
**Date:** 2026-07-17  
**Deciders:** Lee Hine  

## Context

Practice and pilot require durable tenancy. Current store is in-memory only. Hosting today targets Railway.

## Decision

_Pending._ Leading options:

1. **PostgreSQL** managed (Railway Postgres or equivalent) + app on Railway  
2. SQLite only for single-node demos (reject for multi-tenant pilot)

**Proposed lean:** PostgreSQL on same platform as app for pilot simplicity; document exit path if host lock-in becomes a risk.

## Alternatives considered

1. MongoDB / document store — flexible JSON, weaker relational tenancy discipline  
2. Supabase/Firebase — faster auth+db, more vendor coupling  
3. Stay in-memory — unacceptable for pilot ready  

## Consequences

- Need migrations, backups, connection pooling  
- Aligns with [DATA-MODEL.md](../DATA-MODEL.md)  
- Single-host dependence remains a medium risk (R19)  

## Links

- DATA-MODEL.md · ARCHITECTURE.md · risk R19  
