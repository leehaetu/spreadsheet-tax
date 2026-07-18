/**
 * Durable job queue — Postgres when DATABASE_URL set, else SQLite.
 * Workers claim with lock; never auto-submits to HMRC without explicit job type + prior approval payload.
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import { isPostgresMode } from './platform-config.js';
import { pgQuery, pgOne, pgMany } from './pg-pool.js';

function ensureSqliteQueue() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      queue TEXT NOT NULL,
      job_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      available_at TEXT NOT NULL,
      locked_at TEXT,
      locked_by TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_job_queue_poll ON job_queue(queue, status, available_at);
  `);
}

/**
 * @param {{ queue?: string, jobType: string, payload: object, maxAttempts?: number, delayMs?: number }} opts
 */
export async function enqueueJob(opts) {
  const id = crypto.randomUUID();
  const now = new Date();
  const available = new Date(now.getTime() + (opts.delayMs || 0));
  const queue = opts.queue || 'default';
  const payload = JSON.stringify(opts.payload || {});
  const maxAttempts = opts.maxAttempts ?? 5;

  if (isPostgresMode()) {
    await pgQuery(
      `INSERT INTO job_queue (id, queue, job_type, payload_json, status, attempts, max_attempts, available_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
      [
        id,
        queue,
        opts.jobType,
        payload,
        maxAttempts,
        available.toISOString(),
        now.toISOString(),
        now.toISOString(),
      ]
    );
  } else {
    ensureSqliteQueue();
    getDb()
      .prepare(
        `INSERT INTO job_queue (id, queue, job_type, payload_json, status, attempts, max_attempts, available_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`
      )
      .run(
        id,
        queue,
        opts.jobType,
        payload,
        maxAttempts,
        available.toISOString(),
        now.toISOString(),
        now.toISOString()
      );
  }
  return { id, queue, jobType: opts.jobType };
}

/**
 * Claim next job (FOR UPDATE SKIP LOCKED on Postgres).
 * @param {string} queue
 * @param {string} workerId
 */
export async function claimJob(queue, workerId) {
  const now = new Date().toISOString();
  if (isPostgresMode()) {
    const client = await (await import('./pg-pool.js')).getPool().connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `SELECT * FROM job_queue
         WHERE queue = $1 AND status = 'pending' AND available_at <= $2
         ORDER BY available_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [queue, now]
      );
      const row = r.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return null;
      }
      await client.query(
        `UPDATE job_queue SET status = 'running', locked_at = $1, locked_by = $2, attempts = attempts + 1, updated_at = $1
         WHERE id = $3`,
        [now, workerId, row.id]
      );
      await client.query('COMMIT');
      return hydrate(row);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  ensureSqliteQueue();
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM job_queue
       WHERE queue = ? AND status = 'pending' AND available_at <= ?
       ORDER BY available_at ASC LIMIT 1`
    )
    .get(queue, now);
  if (!row) return null;
  database
    .prepare(
      `UPDATE job_queue SET status = 'running', locked_at = ?, locked_by = ?, attempts = attempts + 1, updated_at = ?
       WHERE id = ? AND status = 'pending'`
    )
    .run(now, workerId, now, row.id);
  return hydrate(row);
}

/**
 * @param {string} id
 * @param {object} [result]
 */
export async function completeJob(id, result = {}) {
  const now = new Date().toISOString();
  if (isPostgresMode()) {
    await pgQuery(
      `UPDATE job_queue SET status = 'completed', last_error = NULL, updated_at = ?, payload_json = payload_json WHERE id = ?`,
      [now, id]
    );
    return;
  }
  ensureSqliteQueue();
  getDb()
    .prepare(
      `UPDATE job_queue SET status = 'completed', last_error = NULL, updated_at = ? WHERE id = ?`
    )
    .run(now, id);
  void result;
}

/**
 * @param {string} id
 * @param {string} error
 * @param {number} [retryDelayMs]
 */
export async function failJob(id, error, retryDelayMs = 5000) {
  const now = new Date();
  if (isPostgresMode()) {
    const row = await pgOne(`SELECT * FROM job_queue WHERE id = ?`, [id]);
    if (!row) return;
    if (row.attempts >= row.max_attempts) {
      await pgQuery(
        `UPDATE job_queue SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`,
        [String(error).slice(0, 2000), now.toISOString(), id]
      );
    } else {
      const avail = new Date(now.getTime() + retryDelayMs).toISOString();
      await pgQuery(
        `UPDATE job_queue SET status = 'pending', last_error = ?, available_at = ?, locked_at = NULL, locked_by = NULL, updated_at = ? WHERE id = ?`,
        [String(error).slice(0, 2000), avail, now.toISOString(), id]
      );
    }
    return;
  }
  ensureSqliteQueue();
  const row = getDb().prepare(`SELECT * FROM job_queue WHERE id = ?`).get(id);
  if (!row) return;
  if (row.attempts >= row.max_attempts) {
    getDb()
      .prepare(
        `UPDATE job_queue SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`
      )
      .run(String(error).slice(0, 2000), now.toISOString(), id);
  } else {
    const avail = new Date(now.getTime() + retryDelayMs).toISOString();
    getDb()
      .prepare(
        `UPDATE job_queue SET status = 'pending', last_error = ?, available_at = ?, locked_at = NULL, locked_by = NULL, updated_at = ? WHERE id = ?`
      )
      .run(String(error).slice(0, 2000), avail, now.toISOString(), id);
  }
}

/**
 * @param {string} queue
 */
export async function queueDepth(queue) {
  if (isPostgresMode()) {
    const row = await pgOne(
      `SELECT COUNT(*)::int AS c FROM job_queue WHERE queue = ? AND status IN ('pending','running')`,
      [queue]
    );
    return row?.c || 0;
  }
  ensureSqliteQueue();
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM job_queue WHERE queue = ? AND status IN ('pending','running')`
    )
    .get(queue);
  return row?.c || 0;
}

function hydrate(row) {
  return {
    id: row.id,
    queue: row.queue,
    jobType: row.job_type,
    payload: JSON.parse(row.payload_json),
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
  };
}
