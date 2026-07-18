# Platform implementation status (capacity + Excel)

**Updated:** 2026-07-18 · App **1.28.0**  
**Capacity gate:** still **NOT MET** for 200 practices / 800k until HA Postgres + Redis + full seed + load evidence with `CAPACITY_CLAIM_FULL=1`.  
**Track doc:** [CAPACITY-PLATFORM-TRACK.md](./CAPACITY-PLATFORM-TRACK.md)

## What was missing (last chats) and what shipped in code

| Requirement | Status in 1.28.0 |
|-------------|------------------|
| Postgres-capable schema + pool | **Shipped** `src/lib/pg-pool.js` when `DATABASE_URL` set |
| **Postgres RLS** | **Shipped** `applyRowLevelSecurity()` on clients/drafts/memberships/audit/object_blobs |
| Redis sessions/rate limits/locks | **Shipped** `src/lib/redis-client.js` when `REDIS_URL` set |
| **RBAC / ABAC** | **Shipped** `rbac.js` + `abac.js` + `authorize()` |
| **Tenant firm_id guard** | **Shipped** `tenant-context.js` + practice API checks |
| **Rate limit tiers + global API middleware** | **Shipped** `rate-limit.js` |
| Durable job queue + worker process | **Shipped** `job-queue.js` + `npm run worker` |
| HMRC jobs never auto-file | **Enforced** — `hmrc_submit` requires `userApproved: true` |
| Object storage quarantine + hash | **Shipped** `object-store.js` |
| Isolated Excel parse worker | **Shipped** child process (LibreOffice container still TODO) |
| Capacity seed 200 practices | **Shipped** `npm run seed:capacity` (5k clients CI default) |
| Full 800k seed | **Script ready** `npm run seed:capacity:full` |
| Load / isolation / queue evidence | **Shipped** `npm run load:capacity` + `npm run capacity:evidence` |
| docker-compose Postgres+Redis | **Shipped** `docker-compose.capacity.yml` |
| CAPACITY_ENFORCE boot refuse | **Shipped** when `CAPACITY_ENFORCE=1` |
| Security posture API | **Shipped** `GET /api/security/posture` |
| Managed HA Postgres on Railway | **Ops** — provision; set `DATABASE_URL` |
| LibreOffice disposable containers | **Not yet** |
| 800k gate proven | **NOT MET** |

## How to run capacity path locally

```bash
docker compose -f docker-compose.capacity.yml up -d
export DATABASE_URL=postgres://st:st@localhost:5432/spreadsheet_tax
export REDIS_URL=redis://localhost:6379
export OBJECT_STORAGE_DIR=./data/objects
export CAPACITY_ENFORCE=0   # set 1 only when all platform env present
node -e "import('./src/lib/pg-pool.js').then(m=>m.migratePostgres())"
npm run seed:capacity          # 200 practices, 5k clients
# npm run seed:capacity:full   # 200 + 800k — hours/disk
npm run load:capacity
npm run worker                 # separate process
```

## Honest status sentence

Platform **foundations** for 200/800k are in the repo; **proof of the hard capacity gate is not complete** until full seed on HA Postgres + Redis + documented load/recovery runs. Do not market as pilot-ready.
