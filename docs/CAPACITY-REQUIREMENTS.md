# Capacity requirements (hard gate)

**Locked:** 2026-07-18  
**Owner:** Lee Hine  
**Status:** **NOT MET** — current services cannot claim this capacity  

## Hard requirement (immediate, not future ambition)

Spreadsheet Tax **must** support:

| Dimension | Minimum |
|-----------|---------|
| Accounting practices | **200** |
| Self-employed / landlord customers (registered end users / clients) | **800,000** |

Until this capacity is **implemented and proven** with the acceptance tests below, the product **must not** be described as:

- complete  
- pilot-ready  
- production-ready  
- marketable at scale  
- capable of 200 practices / 800k customers  

**Current honest capability:** pilot-scale only (single Railway service + SQLite + volume). See `docs/RAILWAY.md`.

## Why this is P0

- Single SQLite file on one volume cannot multi-replica.  
- One Node process + in-memory uploads + in-process jobs/rate limits will not survive deadline peaks.  
- 800k users × quarterly cycles ⇒ multi-million workflows/year before corrections/EOY.  
- HMRC throttle + Excel processing need queues and workers, not request-path blocking.

## Required platform (immediate architecture target)

| Component | Purpose |
|-----------|---------|
| Managed HA PostgreSQL | Multi-tenant system of record |
| Stateless horizontally scalable app instances | Web/API behind load balancer |
| Redis | Sessions, rate limits, distributed locks, cache |
| Durable job queues + separate workers | HMRC submit, reminders, email — **never autonomous HMRC submit without customer approval** |
| Isolated XLS/XLSX workers | Resource-limited, no macros, disposable containers |
| Encrypted object storage | Quarantined original spreadsheets + hashes |
| HMRC throttling / backpressure | Queue-aware, idempotent |
| Central monitoring, alerting, audit | Ops + evidence |
| Automated backups, restore, failover | DR |
| Production-like load / endurance / recovery tests | Proof |

## Acceptance gate (must pass before any readiness claim)

1. **Dataset:** ≥200 practices and ≥800,000 customer/client records in the test environment.  
2. **Large practices:** largest practices tested with **tens of thousands** of clients each.  
3. **Deadline traffic:** quarterly peak concurrency simulated (**not** only dormant 800k rows).  
4. **Queues:** spreadsheet import and HMRC submission queues under peak load.  
5. **Integrity:** no lost, changed, or duplicate figures.  
6. **Isolation:** no cross-firm access under concurrent load.  
7. **Latency:** p50 / p95 / **p99** documented and measured.  
8. **Failure:** DB and worker failure recovery demonstrated.  
9. **Peak envelope** (lock numbers before launch): concurrent users, uploads/min, jobs, HMRC submits/min, max workbook, max portfolio, queue recovery time, max error rate.  
10. **Evidence:** test runs recorded, repeatable, and linked from STATUS.  

Master gates beyond capacity: [RELEASE-GATES.md](./RELEASE-GATES.md).

### Suggested latency targets (draft until Lee confirms)

| Surface | p95 under normal | p95 under deadline peak (degraded OK if documented) |
|---------|------------------|------------------------------------------------------|
| Practice client list (filtered page) | &lt; 500 ms | &lt; 2 s |
| Import accept → draft ready (async OK) | ack &lt; 2 s | queue depth SLA documented |
| Submit enqueue | &lt; 1 s | &lt; 3 s |
| HMRC worker cycle | N/A (async) | backlog drains without data loss |

## Explicitly out of “current capability”

| Claim | Allowed? |
|-------|----------|
| Works for sandbox HMRC demos / tiny pilot | Yes, if not marketed as 800k-ready |
| Pilot-ready / production-ready / 200×800k | **No** until gate passes |

## Migration order (engineering)

1. PostgreSQL schema + dual-write or cutover from SQLite  
2. Redis sessions + rate limits  
3. Object storage for uploads  
4. Queue + HMRC/email workers  
5. Excel isolation workers  
6. Horizontal app replicas  
7. Load/chaos suite against 200 / 800k dataset  
8. Only then update STATUS capacity line to **MET** with evidence links  

## Related docs

- `docs/STATUS.md` — living truth  
- `docs/RAILWAY.md` — current pilot infra (superseded as end-state by this doc)  
- `docs/AGENT-TRUTH-PROTOCOL.md` — no overclaim of capacity  
- `docs/EXTERNAL-DEPENDENCIES.md` — HMRC external gates remain separate from capacity  

**Rule for agents:** Never say pilot-ready or production-ready while this document’s acceptance gate is open.
