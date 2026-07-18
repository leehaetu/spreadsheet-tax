/**
 * Operational multi-tenant data path selector.
 * When DATABASE_URL is set, dual-writes critical records to Postgres
 * (system of record for capacity path) while SQLite remains local default.
 */

import { isPostgresMode } from './platform-config.js';
import { migratePostgres, pgQuery, pgOne } from './pg-pool.js';

let pgReady = false;

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function operationalDbMode(env = process.env) {
  return isPostgresMode(env) ? 'postgres' : 'sqlite';
}

/**
 * Ensure PG schema exists (idempotent). No-op without DATABASE_URL.
 */
export async function ensureOperationalPostgres() {
  if (!isPostgresMode()) return { ok: true, mode: 'sqlite' };
  if (!pgReady) {
    await migratePostgres();
    // Integrity columns for attempts
    await pgQuery(`
      ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS evidence_json TEXT;
      ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS correlation_id TEXT;
      ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS supersedes_attempt_id TEXT;
      ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'recorded';
      ALTER TABLE drafts ADD COLUMN IF NOT EXISTS file_sha256 TEXT;
      ALTER TABLE drafts ADD COLUMN IF NOT EXISTS object_key TEXT;
    `).catch(() => {
      /* older PG without IF NOT EXISTS on ADD COLUMN — ignore */
    });
    pgReady = true;
  }
  return { ok: true, mode: 'postgres' };
}

/**
 * Dual-write draft row to Postgres when operational.
 * @param {object} draft — hydrated draft shape from SQLite createDraft
 */
export async function mirrorDraftToPostgres(draft) {
  if (!isPostgresMode() || !draft?.id) return { mirrored: false };
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO drafts (
       id, user_id, client_id, firm_id, filename, payloads_json, summary_json,
       figures_json, validation_json, state, file_sha256, object_key, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       payloads_json = EXCLUDED.payloads_json,
       state = EXCLUDED.state,
       updated_at = EXCLUDED.updated_at`,
    [
      draft.id,
      draft.userId || null,
      draft.clientId || null,
      draft.firmId || null,
      draft.filename || 'unknown',
      JSON.stringify(draft.payloads || {}),
      draft.summary ? JSON.stringify(draft.summary) : null,
      draft.figures ? JSON.stringify(draft.figures) : null,
      draft.validation ? JSON.stringify(draft.validation) : null,
      draft.state || 'ready',
      draft.fileSha256 || null,
      draft.objectKey || null,
      draft.createdAt || new Date().toISOString(),
      draft.updatedAt || new Date().toISOString(),
    ]
  );
  return { mirrored: true, mode: 'postgres' };
}

/**
 * Dual-write submission attempt + evidence to Postgres.
 */
export async function mirrorSubmissionAttemptToPostgres(attempt) {
  if (!isPostgresMode() || !attempt?.id) return { mirrored: false };
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO submission_attempts (
       id, draft_id, user_id, mode, ok, results_json, created_at,
       evidence_json, correlation_id, supersedes_attempt_id, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      attempt.id,
      attempt.draftId || null,
      attempt.userId || null,
      attempt.mode || 'double',
      attempt.ok ? 1 : 0,
      JSON.stringify(attempt.results || []),
      attempt.createdAt || new Date().toISOString(),
      attempt.evidence ? JSON.stringify(attempt.evidence) : null,
      attempt.correlationId || null,
      attempt.supersedesAttemptId || null,
      attempt.status || 'recorded',
    ]
  );
  return { mirrored: true, mode: 'postgres' };
}

/**
 * Dual-write user for capacity path.
 */
export async function mirrorUserToPostgres(user) {
  if (!isPostgresMode() || !user?.id) return { mirrored: false };
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO users (id, email, password_hash, name, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`,
    [
      user.id,
      user.email,
      user.passwordHash || user.password_hash || '',
      user.name || '',
      user.createdAt || user.created_at || new Date().toISOString(),
    ]
  );
  return { mirrored: true };
}

/**
 * Health fragment for /api/status
 */
export function operationalStoreHealth() {
  return {
    dbMode: operationalDbMode(),
    postgresConfigured: isPostgresMode(),
    dualWriteEnabled: isPostgresMode(),
    note: isPostgresMode()
      ? 'Postgres dual-write active for drafts/attempts/users when mirrored'
      : 'SQLite default — set DATABASE_URL for operational multi-tenant path',
  };
}
