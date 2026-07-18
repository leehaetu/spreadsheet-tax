/**
 * Managed PostgreSQL pool (capacity path).
 * Set DATABASE_URL=postgres://...
 */

import pg from 'pg';
import { isPostgresMode } from './platform-config.js';

const { Pool } = pg;

/** @type {import('pg').Pool | null} */
let pool = null;

export function getPool() {
  if (!isPostgresMode()) {
    throw new Error('getPool() requires DATABASE_URL');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/**
 * Convert SQL with ? placeholders to $1,$2 style.
 * @param {string} sql
 */
export function toPgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * @param {string} sql
 * @param {unknown[]} [params]
 */
export async function pgQuery(sql, params = []) {
  const p = getPool();
  return p.query(toPgParams(sql), params);
}

/**
 * @param {string} sql
 * @param {unknown[]} [params]
 */
export async function pgOne(sql, params = []) {
  const r = await pgQuery(sql, params);
  return r.rows[0] || null;
}

/**
 * @param {string} sql
 * @param {unknown[]} [params]
 */
export async function pgMany(sql, params = []) {
  const r = await pgQuery(sql, params);
  return r.rows;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Create capacity schema (idempotent). */
export async function migratePostgres() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS firms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS firm_memberships (
      id TEXT PRIMARY KEY,
      firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      UNIQUE(firm_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      workflow_status TEXT NOT NULL,
      assignee_user_id TEXT,
      due_date TEXT,
      portal_enabled INTEGER NOT NULL DEFAULT 1,
      portal_token TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      client_id TEXT,
      firm_id TEXT,
      filename TEXT NOT NULL,
      payloads_json TEXT NOT NULL,
      summary_json TEXT,
      figures_json TEXT,
      validation_json TEXT,
      state TEXT NOT NULL,
      file_sha256 TEXT,
      object_key TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submission_attempts (
      id TEXT PRIMARY KEY,
      draft_id TEXT,
      user_id TEXT,
      mode TEXT NOT NULL,
      ok INTEGER NOT NULL,
      results_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      evidence_json TEXT,
      correlation_id TEXT,
      supersedes_attempt_id TEXT,
      status TEXT DEFAULT 'recorded'
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      firm_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      meta_json TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      user_id TEXT,
      response_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      queue TEXT NOT NULL,
      job_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ,
      locked_by TEXT,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS object_blobs (
      id TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      original_name TEXT NOT NULL,
      content_type TEXT,
      byte_size INTEGER NOT NULL,
      user_id TEXT,
      firm_id TEXT,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_clients_firm ON clients(firm_id);
    CREATE INDEX IF NOT EXISTS idx_clients_firm_status ON clients(firm_id, workflow_status);
    CREATE INDEX IF NOT EXISTS idx_clients_firm_due ON clients(firm_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_clients_firm_name ON clients(firm_id, display_name);
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON firm_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_job_queue_poll ON job_queue(queue, status, available_at);
    CREATE INDEX IF NOT EXISTS idx_object_sha ON object_blobs(sha256);
  `);
}
