/**
 * Operational multi-tenant store.
 * When DATABASE_URL is set, Postgres is the system-of-record for
 * users, sessions, drafts, clients, submission_attempts, and audit_events.
 * SQLite remains the default local store when DATABASE_URL is unset.
 */

import { isPostgresMode } from './platform-config.js';
import { migratePostgres, pgQuery, pgOne, pgMany } from './pg-pool.js';

let pgReady = false;

/** @type {Array<{ kind: string, id?: string }>} test/observability of mirror calls */
export const mirrorCallLog = [];

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function operationalDbMode(env = process.env) {
  return isPostgresMode(env) ? 'postgres' : 'sqlite';
}

/**
 * System-of-record mode: postgres when DATABASE_URL set, else sqlite.
 */
export function systemOfRecordMode(env = process.env) {
  return operationalDbMode(env);
}

export async function ensureOperationalPostgres() {
  if (!isPostgresMode()) return { ok: true, mode: 'sqlite' };
  if (!pgReady) {
    await migratePostgres();
    try {
      await pgQuery(`
        ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS evidence_json TEXT;
        ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS correlation_id TEXT;
        ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS supersedes_attempt_id TEXT;
        ALTER TABLE submission_attempts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'recorded';
        ALTER TABLE drafts ADD COLUMN IF NOT EXISTS file_sha256 TEXT;
        ALTER TABLE drafts ADD COLUMN IF NOT EXISTS object_key TEXT;
      `);
    } catch {
      /* column may already exist on older PG */
    }
    pgReady = true;
  }
  return { ok: true, mode: 'postgres' };
}

function logCall(kind, id) {
  mirrorCallLog.push({ kind, id, at: Date.now() });
  if (mirrorCallLog.length > 200) mirrorCallLog.shift();
}

export function clearMirrorCallLog() {
  mirrorCallLog.length = 0;
}

export async function mirrorUserToPostgres(user) {
  if (!isPostgresMode() || !user?.id) return { mirrored: false };
  logCall('user', user.id);
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO users (id, email, password_hash, name, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name`,
    [
      user.id,
      user.email,
      user.passwordHash || user.password_hash || '',
      user.name || '',
      user.createdAt || user.created_at || new Date().toISOString(),
    ]
  );
  return { mirrored: true, mode: 'postgres', sor: true };
}

export async function mirrorSessionToPostgres(session, userId) {
  if (!isPostgresMode() || !session?.id || !userId) return { mirrored: false };
  logCall('session', session.id);
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO sessions (id, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [
      session.id,
      userId,
      session.expiresAt instanceof Date
        ? session.expiresAt.toISOString()
        : session.expiresAt,
      new Date().toISOString(),
    ]
  );
  return { mirrored: true, mode: 'postgres', sor: true };
}

export async function deleteSessionFromPostgres(sessionId) {
  if (!isPostgresMode() || !sessionId) return { mirrored: false };
  logCall('session_delete', sessionId);
  await ensureOperationalPostgres();
  await pgQuery(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  return { mirrored: true };
}

/**
 * Read session+user from Postgres SoR when DATABASE_URL set.
 * @returns {Promise<{ id: string, email: string, name: string, sessionId: string }|null>}
 */
export async function getSessionUserFromPostgres(sessionId) {
  if (!isPostgresMode() || !sessionId) return null;
  await ensureOperationalPostgres();
  const row = await pgOne(
    `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [sessionId]
  );
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await pgQuery(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    sessionId: row.session_id,
  };
}

export async function mirrorDraftToPostgres(draft) {
  if (!isPostgresMode() || !draft?.id) return { mirrored: false };
  logCall('draft', draft.id);
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO drafts (
       id, user_id, client_id, firm_id, filename, payloads_json, summary_json,
       figures_json, validation_json, state, file_sha256, object_key, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       payloads_json = EXCLUDED.payloads_json,
       state = EXCLUDED.state,
       updated_at = EXCLUDED.updated_at,
       summary_json = EXCLUDED.summary_json,
       figures_json = EXCLUDED.figures_json,
       validation_json = EXCLUDED.validation_json`,
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
  return { mirrored: true, mode: 'postgres', sor: true };
}

/**
 * Read draft from Postgres SoR.
 */
export async function getDraftFromPostgres(id) {
  if (!isPostgresMode() || !id) return null;
  await ensureOperationalPostgres();
  const row = await pgOne(`SELECT * FROM drafts WHERE id = ?`, [id]);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    firmId: row.firm_id,
    filename: row.filename,
    payloads: JSON.parse(row.payloads_json),
    summary: row.summary_json ? JSON.parse(row.summary_json) : null,
    figures: row.figures_json ? JSON.parse(row.figures_json) : null,
    validation: row.validation_json ? JSON.parse(row.validation_json) : null,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function mirrorSubmissionAttemptToPostgres(attempt) {
  if (!isPostgresMode() || !attempt?.id) return { mirrored: false };
  logCall('attempt', attempt.id);
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
  return { mirrored: true, mode: 'postgres', sor: true };
}

export async function mirrorClientToPostgres(client) {
  if (!isPostgresMode() || !client?.id) return { mirrored: false };
  logCall('client', client.id);
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO clients (
       id, firm_id, display_name, workflow_status, assignee_user_id, due_date,
       portal_enabled, portal_token, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       workflow_status = EXCLUDED.workflow_status,
       due_date = EXCLUDED.due_date,
       updated_at = EXCLUDED.updated_at`,
    [
      client.id,
      client.firmId || client.firm_id,
      client.name || client.display_name || client.displayName,
      client.status || client.workflow_status || 'awaiting_records',
      client.assigneeUserId || client.assignee_user_id || null,
      client.dueDate || client.due_date || null,
      client.portalAccess || client.portal_enabled ? 1 : 0,
      client.portalToken || client.portal_token || null,
      client.createdAt || client.created_at || new Date().toISOString(),
      client.updatedAt || client.updated_at || new Date().toISOString(),
    ]
  );
  return { mirrored: true, mode: 'postgres', sor: true };
}

export async function mirrorAuditToPostgres(event) {
  if (!isPostgresMode() || !event?.id) return { mirrored: false };
  logCall('audit', event.id);
  await ensureOperationalPostgres();
  await pgQuery(
    `INSERT INTO audit_events (
       id, firm_id, user_id, action, entity_type, entity_id, meta_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      event.id,
      event.firmId || null,
      event.userId || null,
      event.action,
      event.entityType || null,
      event.entityId || null,
      event.meta ? JSON.stringify(event.meta) : null,
      event.createdAt || new Date().toISOString(),
    ]
  );
  return { mirrored: true, mode: 'postgres', sor: true };
}

/**
 * Fire-and-forget safe mirror (never throws to callers).
 * @param {() => Promise<unknown>} fn
 */
export function scheduleMirror(fn) {
  if (!isPostgresMode()) return;
  Promise.resolve()
    .then(() => fn())
    .catch((e) => {
      console.warn('[operational-store] mirror failed', e?.message || e);
    });
}

export function operationalStoreHealth() {
  return {
    dbMode: operationalDbMode(),
    systemOfRecord: systemOfRecordMode(),
    postgresConfigured: isPostgresMode(),
    dualWriteEnabled: isPostgresMode(),
    note: isPostgresMode()
      ? 'Postgres is system-of-record for users/sessions/drafts/clients/attempts/audit (mirrored from app writes)'
      : 'SQLite default — set DATABASE_URL for operational multi-tenant SoR',
  };
}
