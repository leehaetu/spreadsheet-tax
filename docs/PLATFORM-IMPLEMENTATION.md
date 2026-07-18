# Platform implementation status (capacity + Excel)

**Updated:** 2026-07-18 · App **1.17.0**  
**Capacity gate:** still **NOT MET** for 200 practices / 800k until HA Postgres + Redis + full seed + load evidence with `CAPACITY_CLAIM_FULL=1`.

## What was missing (last chats) and what shipped in code

| Requirement | Status in 1.17.0 |
|-------------|------------------|
| Postgres-capable schema + pool | **Shipped** `src/lib/pg-pool.js` when `DATABASE_URL` set |
| Redis sessions/rate limits/locks | **Shipped** `src/lib/redis-client.js` when `REDIS_URL` set; rate limit uses Redis first |
| Durable job queue + worker process | **Shipped** `src/lib/job-queue.js` + `src/workers/job-runner.js` (`npm run worker`) |
| HMRC jobs never auto-file | **Enforced** — `hmrc_submit` requires `userApproved: true` |
| Object storage quarantine + hash | **Shipped** `src/lib/object-store.js` (local dir; S3 later) |
| Magic-byte file type detection | **Shipped** (xlsx zip / xls OLE / csv) |
| First-class Excel (not production-disable) | **Shipped** — kill switch only; import uses isolated worker |
| Isolated Excel parse worker | **Shipped** child process `excel-parse-worker.js` (LibreOffice container still TODO) |
| Capacity seed 200 practices | **Shipped** `npm run seed:capacity` (default 5k clients for CI) |
| Full 800k seed | **Script ready** `npm run seed:capacity:full` (long; needs disk/Postgres) |
| Load / isolation / queue evidence | **Shipped** `npm run load:capacity` |
| docker-compose Postgres+Redis | **Shipped** `docker-compose.capacity.yml` |
| CAPACITY_ENFORCE boot refuse | **Shipped** when `CAPACITY_ENFORCE=1` |
| Managed HA Postgres on Railway | **Ops** — provision service; set `DATABASE_URL` |
| LibreOffice disposable containers | **Not yet** — next isolation harding |
| ClamAV malware engine | **Stub** (`MALWARE_SCAN` hook) |
| Full app dual-write all tables on PG | **Partial** — schema+seed+queue; full cutover of auth/practice still SQLite-default |
| 800k gate proven | **NOT MET** — requires full seed + Postgres/Redis + claim flag |

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
