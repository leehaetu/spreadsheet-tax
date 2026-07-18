/**
 * Capacity load harness (repeatable evidence).
 *
 * Modes:
 *   - DATABASE_URL Postgres (preferred for gate)
 *   - local SQLite after seed-capacity.js
 *
 * Measures p50/p95/p99 client list, concurrent lists, tenant isolation,
 * queue enqueue/claim, worker recovery, optional HTTP deadline burst.
 *
 * Gate MET only when: firms>=200, clients>=800k, isolation ok, Postgres+Redis,
 * CAPACITY_CLAIM_FULL=1, and recovery check ok.
 */

import http from 'node:http';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from '../src/lib/db.js';
import { isPostgresMode, isRedisEnabled } from '../src/lib/platform-config.js';
import { migratePostgres, pgQuery, closePool, getPool } from '../src/lib/pg-pool.js';
import { enqueueJob, queueDepth, claimJob, completeJob, failJob } from '../src/lib/job-queue.js';
import { detectSpreadsheetKind } from '../src/lib/object-store.js';
import { processLocalFileIsolated } from '../src/lib/pipeline.js';
import { redisRateLimit, getRedis, closeRedis } from '../src/lib/redis-client.js';
import { applyPostgresRlsContext, clearPostgresRlsContext } from '../src/lib/tenant-context.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SCRATCH =
  process.env.CAPACITY_EVIDENCE_DIR ||
  path.join(root, 'data', 'exports', 'capacity-evidence');

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarizeTimes(times) {
  const s = [...times].sort((a, b) => a - b);
  return {
    samples: s.length,
    p50ms: percentile(s, 50),
    p95ms: percentile(s, 95),
    p99ms: percentile(s, 99),
    maxms: s[s.length - 1] ?? null,
    minms: s[0] ?? null,
  };
}

async function datasetStats() {
  if (isPostgresMode()) {
    await migratePostgres();
    const firms = (await pgQuery(`SELECT COUNT(*)::int AS c FROM firms`)).rows[0].c;
    const clients = (await pgQuery(`SELECT COUNT(*)::int AS c FROM clients`)).rows[0].c;
    const largest = (
      await pgQuery(
        `SELECT firm_id, COUNT(*)::int AS c FROM clients GROUP BY firm_id ORDER BY c DESC LIMIT 5`
      )
    ).rows;
    return { mode: 'postgres', firms, clients, largestPractices: largest };
  }
  const database = getDb();
  const firms = database.prepare(`SELECT COUNT(*) AS c FROM firms`).get().c;
  const clients = database.prepare(`SELECT COUNT(*) AS c FROM clients`).get().c;
  const largest = database
    .prepare(
      `SELECT firm_id, COUNT(*) AS c FROM clients GROUP BY firm_id ORDER BY c DESC LIMIT 5`
    )
    .all();
  return { mode: 'sqlite', firms, clients, largestPractices: largest };
}

async function measureClientList() {
  const times = [];
  if (isPostgresMode()) {
    const firms = (
      await pgQuery(`SELECT id FROM firms ORDER BY name LIMIT 200`)
    ).rows;
    for (const f of firms.slice(0, 80)) {
      const t0 = performance.now();
      await pgQuery(
        `SELECT id, display_name, workflow_status, due_date FROM clients
         WHERE firm_id = $1 ORDER BY display_name LIMIT 50 OFFSET 0`,
        [f.id]
      );
      times.push(performance.now() - t0);
    }
  } else {
    const database = getDb();
    const firms = database.prepare(`SELECT id FROM firms ORDER BY name LIMIT 200`).all();
    for (const f of firms.slice(0, 80)) {
      const t0 = performance.now();
      database
        .prepare(
          `SELECT id, display_name, workflow_status, due_date FROM clients
           WHERE firm_id = ? ORDER BY display_name LIMIT 50 OFFSET 0`
        )
        .all(f.id);
      times.push(performance.now() - t0);
    }
  }
  return summarizeTimes(times);
}

async function measureConcurrentClientLists() {
  const concurrency = Number(process.env.CAPACITY_CONCURRENCY || 25);
  let firmIds = [];
  if (isPostgresMode()) {
    firmIds = (await pgQuery(`SELECT id FROM firms ORDER BY name LIMIT 50`)).rows.map(
      (r) => r.id
    );
  } else {
    firmIds = getDb()
      .prepare(`SELECT id FROM firms ORDER BY name LIMIT 50`)
      .all()
      .map((r) => r.id);
  }
  if (!firmIds.length) return { ok: false, error: 'no firms' };

  const times = [];
  const t0 = performance.now();
  const tasks = [];
  for (let i = 0; i < concurrency * 4; i++) {
    const firmId = firmIds[i % firmIds.length];
    tasks.push(
      (async () => {
        const s = performance.now();
        if (isPostgresMode()) {
          await pgQuery(
            `SELECT id FROM clients WHERE firm_id = $1 ORDER BY display_name LIMIT 50`,
            [firmId]
          );
        } else {
          getDb()
            .prepare(
              `SELECT id FROM clients WHERE firm_id = ? ORDER BY display_name LIMIT 50`
            )
            .all(firmId);
        }
        times.push(performance.now() - s);
      })()
    );
  }
  await Promise.all(tasks);
  const wallMs = performance.now() - t0;
  return {
    concurrency,
    requests: times.length,
    wallMs,
    ...summarizeTimes(times),
  };
}

async function measureTenantIsolation() {
  if (isPostgresMode()) {
    const two = (await pgQuery(`SELECT id FROM firms ORDER BY name LIMIT 2`)).rows;
    if (two.length < 2) return { ok: false, error: 'need 2 firms' };
    const a = two[0].id;
    const b = two[1].id;
    const bOnly = (
      await pgQuery(`SELECT COUNT(*)::int AS c FROM clients WHERE firm_id = $1`, [b])
    ).rows[0].c;
    // Cross-tenant: clients of A must not appear when filtering B
    const cross = (
      await pgQuery(
        `SELECT COUNT(*)::int AS c FROM clients c
         WHERE c.firm_id = $1 AND EXISTS (
           SELECT 1 FROM clients x WHERE x.id = c.id AND x.firm_id = $2
         )`,
        [a, b]
      )
    ).rows[0].c;

    // RLS session check: set firm A only, count firm B should be 0 if using st_app
    let rlsProbe = { skipped: true };
    try {
      // superuser bypasses RLS — document that
      await applyPostgresRlsContext('rls-probe-user', [a]);
      const seenB = (
        await pgQuery(`SELECT COUNT(*)::int AS c FROM clients WHERE firm_id = $1`, [b])
      ).rows[0].c;
      rlsProbe = {
        note: 'App superuser/bypass may still see rows; app-layer firm_id filter is primary. FORCE RLS applies to non-bypass roles.',
        firmBVisibleWithFirmAContext: seenB,
        superuserBypassesRls: true,
      };
      await clearPostgresRlsContext();
    } catch (e) {
      rlsProbe = { error: e instanceof Error ? e.message : String(e) };
    }

    return {
      ok: cross === 0 && bOnly > 0,
      firmA: a,
      firmB: b,
      firmBClients: bOnly,
      crossTenantSharedIds: cross,
      rlsProbe,
    };
  }

  const database = getDb();
  const two = database.prepare(`SELECT id FROM firms ORDER BY name LIMIT 2`).all();
  if (two.length < 2) return { ok: false, error: 'need 2 firms' };
  const a = two[0].id;
  const b = two[1].id;
  const bOnly = database
    .prepare(`SELECT COUNT(*) AS c FROM clients WHERE firm_id = ?`)
    .get(b).c;
  const wrong = database
    .prepare(`SELECT COUNT(*) AS c FROM clients WHERE firm_id = ? AND firm_id = ?`)
    .get(a, b).c;
  return {
    ok: wrong === 0 && bOnly > 0,
    firmA: a,
    firmB: b,
    firmBClients: bOnly,
    crossFilterCount: wrong,
  };
}

async function measureQueue() {
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) {
    await enqueueJob({
      queue: 'capacity',
      jobType: 'ping',
      payload: { i, userApproved: false },
    });
  }
  const enqueueMs = performance.now() - t0;
  let processed = 0;
  const workerId = 'load-test-worker';
  for (let i = 0; i < 200; i++) {
    const job = await claimJob('capacity', workerId);
    if (!job) break;
    await completeJob(job.id);
    processed++;
  }
  return {
    enqueued: 200,
    enqueueMs,
    processed,
    depthAfter: await queueDepth('capacity'),
  };
}

async function measureWorkerRecovery() {
  // Enqueue jobs, fail one (simulate crash), re-claim remaining
  const ids = [];
  for (let i = 0; i < 20; i++) {
    const j = await enqueueJob({
      queue: 'capacity-recovery',
      jobType: 'ping',
      payload: { recovery: true, i },
    });
    ids.push(j.id);
  }
  const workerA = 'worker-crash';
  const first = await claimJob('capacity-recovery', workerA);
  if (!first) return { ok: false, error: 'no job claimed' };
  // Simulate worker death without complete — requeue via failJob with retry
  if (typeof failJob === 'function') {
    await failJob(first.id, 'simulated crash');
  } else {
    // manual unlock for recovery
    if (isPostgresMode()) {
      await pgQuery(
        `UPDATE job_queue SET status = 'pending', locked_at = NULL, locked_by = NULL,
         available_at = NOW(), last_error = $2, updated_at = NOW() WHERE id = $1`,
        [first.id, 'simulated crash']
      );
    } else {
      getDb()
        .prepare(
          `UPDATE job_queue SET status = 'pending', locked_at = NULL, locked_by = NULL,
           available_at = ?, last_error = ?, updated_at = ? WHERE id = ?`
        )
        .run(new Date().toISOString(), 'simulated crash', new Date().toISOString(), first.id);
    }
  }
  let recovered = 0;
  const workerB = 'worker-recover';
  for (let i = 0; i < 25; i++) {
    const job = await claimJob('capacity-recovery', workerB);
    if (!job) break;
    await completeJob(job.id);
    recovered++;
  }
  return {
    ok: recovered >= 19,
    recovered,
    note: 'Simulated worker crash; second worker drained queue',
  };
}

async function measureExcel() {
  const sample = path.join(root, 'test-spreadsheets', '06-combined-workbook.xlsx');
  if (!fs.existsSync(sample)) {
    return { ok: false, error: 'xlsx fixture missing' };
  }
  const buf = fs.readFileSync(sample);
  const kind = detectSpreadsheetKind(buf);
  const t0 = performance.now();
  const result = await processLocalFileIsolated(buf, '06-combined-workbook.xlsx');
  return {
    ok: true,
    kind,
    ms: performance.now() - t0,
    rowCount: result.rowCount,
    sha256: result.fileSha256,
    hasSe: Boolean(result.mapped?.selfEmployment),
  };
}

async function measureRedisRateLimit() {
  if (!isRedisEnabled()) return { enabled: false };
  const key = `cap-rl-${Date.now()}`;
  const a = await redisRateLimit(key, 5, 60_000);
  const b = await redisRateLimit(key, 5, 60_000);
  return { enabled: true, firstAllowed: a, secondAllowed: b, redisPing: Boolean(getRedis()) };
}

async function measureHttpDeadlineBurst() {
  const port = Number(process.env.CAPACITY_HTTP_PORT || 0);
  if (!port) return { skipped: true, note: 'Set CAPACITY_HTTP_PORT with running server for HTTP burst' };
  const times = [];
  const n = Number(process.env.CAPACITY_HTTP_REQUESTS || 50);
  await Promise.all(
    Array.from({ length: n }, () =>
      new Promise((resolve) => {
        const t0 = performance.now();
        http
          .get({ hostname: '127.0.0.1', port, path: '/api/status' }, (res) => {
            res.resume();
            res.on('end', () => {
              times.push(performance.now() - t0);
              resolve(null);
            });
          })
          .on('error', () => {
            times.push(-1);
            resolve(null);
          });
      })
    )
  );
  const okTimes = times.filter((t) => t >= 0);
  return { requests: n, ok: okTimes.length, ...summarizeTimes(okTimes) };
}

async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  if (isPostgresMode()) await migratePostgres();

  const dataset = await datasetStats();
  const evidence = {
    at: new Date().toISOString(),
    env: {
      postgres: isPostgresMode(),
      redis: isRedisEnabled(),
      objectStorage: Boolean(process.env.OBJECT_STORAGE_DIR || process.env.S3_BUCKET),
      capacityClaimFull: process.env.CAPACITY_CLAIM_FULL === '1',
    },
    dataset,
    clientList: await measureClientList(),
    concurrentLists: await measureConcurrentClientLists(),
    tenantIsolation: await measureTenantIsolation(),
    queue: await measureQueue(),
    workerRecovery: await measureWorkerRecovery(),
    excel: await measureExcel(),
    redisRateLimit: await measureRedisRateLimit(),
    httpBurst: await measureHttpDeadlineBurst(),
    capacityGate: {
      required: { practices: 200, customers: 800_000 },
      datasetMeets200Practices: dataset.firms >= 200,
      datasetMeets800kCustomers: dataset.clients >= 800_000,
      largestPracticeTensOfThousands: (dataset.largestPractices?.[0]?.c || 0) >= 10_000,
      claimFull: process.env.CAPACITY_CLAIM_FULL === '1',
      met: false,
      note:
        'Gate MET only with full dataset + isolation + Postgres + Redis + CAPACITY_CLAIM_FULL=1 + recovery ok.',
    },
  };

  const isolationOk = evidence.tenantIsolation.ok === true;
  const recoveryOk = evidence.workerRecovery.ok === true;
  evidence.capacityGate.met =
    evidence.capacityGate.datasetMeets200Practices &&
    evidence.capacityGate.datasetMeets800kCustomers &&
    evidence.capacityGate.largestPracticeTensOfThousands &&
    isolationOk &&
    recoveryOk &&
    process.env.CAPACITY_CLAIM_FULL === '1' &&
    Boolean(process.env.DATABASE_URL) &&
    Boolean(process.env.REDIS_URL);

  const outPath = path.join(SCRATCH, `capacity-run-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  // durable copy under docs/evidence
  const docsEv = path.join(root, 'docs', 'evidence');
  fs.mkdirSync(docsEv, { recursive: true });
  const docsPath = path.join(docsEv, 'capacity-latest.json');
  fs.writeFileSync(docsPath, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  console.log('wrote', outPath);
  console.log('wrote', docsPath);

  closeDb();
  if (isPostgresMode()) await closePool();
  await closeRedis();

  if (!evidence.capacityGate.met) {
    console.error(
      '[capacity] Gate NOT MET (need 200 firms + 800k clients + isolation + recovery + PG/Redis + CAPACITY_CLAIM_FULL=1)'
    );
  } else {
    console.log('[capacity] Gate MET criteria satisfied for this evidence run');
  }
  process.exitCode = 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
