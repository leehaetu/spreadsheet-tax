# ADR 0004: Firm tenancy enforcement

**Status:** Accepted · **Date:** 2026-07-18 · **Deciders:** Lee Hine  

## Context

Multi-client practice requires hard isolation between firms. UI-only filtering is not sufficient.

## Decision

1. **Every firm-scoped row carries `firm_id`** (clients, firm drafts, audit, memberships, object blobs).  
2. **Authorize via `firm_memberships` only** — never trust client-supplied `firm_id` alone (`assertClientFirmId` / `userCanAccessFirm`).  
3. **RBAC** — roles `practice_admin`, `accountant`, `bookkeeper` with a permission matrix (`src/lib/rbac.js`).  
4. **ABAC** — resource attributes (owner, firm, assignee, dual-control preparer) evaluated in `src/lib/abac.js`.  
5. **Postgres RLS** — defence-in-depth when `DATABASE_URL` is set: policies on clients, drafts, memberships, audit, object_blobs using session vars `app.user_id` / `app.firm_ids` (`src/lib/pg-pool.js` + `tenant-context.js`).  
6. **SQLite** — app-layer isolation only (no native RLS); production capacity path requires Postgres.  
7. **Cross-tenant tests are mandatory** (`tests/tenant-isolation.test.js`, `tests/security-controls.test.js`).

## Alternatives considered

| Option | Why rejected |
|--------|----------------|
| Soft UI filtering only | Trivial IDOR |
| Single shared firm | Not multi-tenant |
| RLS without app checks | Ops bypass risk if SET ROLE wrong; both layers required |

## Consequences

- All practice list/dashboard endpoints must pass tenant checks.  
- Capacity claims still require load evidence; RLS does not equal 800k capacity.  
