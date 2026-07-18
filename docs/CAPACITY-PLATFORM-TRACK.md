# Capacity platform — next executable engineering track

**Status:** Foundations expanded · **Hard gate still NOT MET** (200 practices / 800k customers)  
**Related:** [CAPACITY-REQUIREMENTS.md](./CAPACITY-REQUIREMENTS.md) · [PLATFORM-IMPLEMENTATION.md](./PLATFORM-IMPLEMENTATION.md) · ADR [0004](./DECISIONS/0004-firm-tenancy.md)

## Goal

Prove the product can host **200 practices** and **800,000** customers with tenant isolation, durable jobs, and measured load — without overclaiming.

## Track phases (execute in order)

### P0 — Security controls (this ship)

| Item | Module / proof |
|------|----------------|
| RBAC matrix | `src/lib/rbac.js` · unit tests |
| ABAC attributes | `src/lib/abac.js` · dual-control / assignee |
| Tenant firm_id guard | `src/lib/tenant-context.js` |
| Postgres RLS | `migratePostgres` → `applyRowLevelSecurity` |
| Rate limiting tiers | `src/lib/rate-limit.js` + global middleware |
| Posture API | `GET /api/security/posture` |

### P1 — Platform runtime (ops + code)

1. **Postgres** — provision managed HA Postgres; set `DATABASE_URL`.  
2. **Redis** — set `REDIS_URL` for rate limits, locks, optional sessions.  
3. **Object storage** — `OBJECT_STORAGE_DIR` or `S3_BUCKET`.  
4. **Workers** — run `npm run worker` as a separate process (never auto HMRC without approval).  
5. **CAPACITY_ENFORCE=1** in production only when all of the above are present.

```bash
docker compose -f docker-compose.capacity.yml up -d
export DATABASE_URL=postgres://st:st@localhost:5432/spreadsheet_tax
export REDIS_URL=redis://localhost:6379
export OBJECT_STORAGE_DIR=./data/objects
node -e "import('./src/lib/pg-pool.js').then(m=>m.migratePostgres().then(()=>console.log('migrated')))"
npm run seed:capacity
npm run load:capacity
npm run worker
```

### P2 — Dataset evidence

| Mode | Command | Clients |
|------|---------|--------:|
| CI / local | `npm run seed:capacity` | 5_000 |
| Full gate | `CAPACITY_SEED_FULL=1 npm run seed:capacity` | 800_000 |

### P3 — Load + isolation + recovery evidence

```bash
npm run load:capacity
# writes under data/exports/capacity-evidence/
# copy summary into docs/evidence/ when claiming progress
```

**Do not set `CAPACITY_CLAIM_FULL=1` or mark STATUS capacity MET** until:

- Full seed completed on Postgres  
- Load harness p95 numbers recorded  
- Isolation checks pass under concurrency  
- Worker drain after simulated outage documented  
- Recovery/backup rehearsal logged  

### P4 — Horizontal scale

- Stateless app replicas behind LB  
- Sticky sessions not required if Redis sessions enabled  
- Queue depth SLAs under deadline traffic  

## Honest non-claims

- Code + seed scripts ≠ capacity MET.  
- RLS/RBAC/ABAC ≠ pen-test done.  
- Local SQLite seed ≠ production HA proof.

## Evidence locations

| Artifact | Path |
|----------|------|
| Load harness | `scripts/load-test-capacity.js` |
| Seed | `scripts/seed-capacity.js` |
| Evidence dir | `data/exports/capacity-evidence/` (local) |
| Security tests | `tests/security-controls.test.js` |
| Tenant tests | `tests/tenant-isolation.test.js` |
