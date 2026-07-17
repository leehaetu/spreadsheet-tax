# ADR 0001: Database and hosting

**Status:** Accepted (interim)  
**Date:** 2026-07-17  
**Deciders:** Lee Hine  

## Context

Practice and pilot require durable tenancy. Current store is in-memory only. Hosting today targets Railway.

## Decision

**Interim:** **SQLite** via Node `node:sqlite` (`DATA_DIR` / `SQLITE_PATH`) for pilot foundation without external DB provisioning.  
**Next:** migrate to managed **PostgreSQL** when multi-instance / Railway production scale requires it (same schema intent in DATA-MODEL.md).

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
