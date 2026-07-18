/**
 * Server-owned draft submissions (source of truth for submit).
 */

import { getDb } from './db.js';
import { newId } from './auth.js';

export function createDraft({
  userId = null,
  clientId = null,
  firmId = null,
  filename,
  payloads,
  summary = null,
  figures = null,
  validation = null,
}) {
  const database = getDb();
  const id = newId();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO drafts (
        id, user_id, client_id, firm_id, filename, payloads_json, summary_json,
        figures_json, validation_json, state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`
    )
    .run(
      id,
      userId,
      clientId,
      firmId,
      filename,
      JSON.stringify(payloads),
      summary ? JSON.stringify(summary) : null,
      figures ? JSON.stringify(figures) : null,
      validation ? JSON.stringify(validation) : null,
      now,
      now
    );
  return getDraft(id);
}

export function getDraft(id) {
  const row = getDb().prepare(`SELECT * FROM drafts WHERE id = ?`).get(id);
  if (!row) return null;
  return hydrateDraft(row);
}

function hydrateDraft(row) {
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

export function listDraftsForUser(userId, limit = 20) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit);
  return rows.map(hydrateDraft);
}

export function markDraftSubmitted(draftId) {
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE drafts SET state = 'submitted', updated_at = ? WHERE id = ?`)
    .run(now, draftId);
}

/**
 * @param {string} draftId
 * @param {string|null} userId
 */
export function deleteDraft(draftId, userId) {
  const draft = getDraft(draftId);
  if (!draft) return { error: 'Draft not found', status: 404 };
  if (draft.userId && userId && draft.userId !== userId) {
    return { error: 'Not allowed', status: 403 };
  }
  if (draft.userId && !userId) {
    return { error: 'Sign in required', status: 401 };
  }
  getDb().prepare(`DELETE FROM drafts WHERE id = ?`).run(draftId);
  return { ok: true };
}

/**
 * @param {string} draftId
 * @param {string} userId
 * @param {string} filename
 */
export function renameDraft(draftId, userId, filename) {
  const draft = getDraft(draftId);
  if (!draft) return { error: 'Draft not found', status: 404 };
  if (draft.userId !== userId) {
    return { error: 'Not allowed', status: 403 };
  }
  const name = String(filename || '').trim().slice(0, 200);
  if (!name) return { error: 'Name required', status: 400 };
  const now = new Date().toISOString();
  getDb()
    .prepare(`UPDATE drafts SET filename = ?, updated_at = ? WHERE id = ?`)
    .run(name, now, draftId);
  return { ok: true, draft: getDraft(draftId) };
}

/**
 * CSV of personal submission attempts for the signed-in user.
 * @param {string} userId
 */
export function exportSubmissionsCsv(userId) {
  const rows = getDb()
    .prepare(
      `SELECT id, draft_id, mode, ok, created_at FROM submission_attempts
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`
    )
    .all(userId);
  const header = 'attempt_id,draft_id,mode,ok,created_at\n';
  const body = rows
    .map((r) =>
      [r.id, r.draft_id || '', r.mode, r.ok ? 'yes' : 'no', r.created_at].join(
        ','
      )
    )
    .join('\n');
  return header + body + (body ? '\n' : '');
}

export function recordSubmissionAttempt({
  draftId,
  userId,
  mode,
  ok,
  results,
  idempotencyKey = null,
  evidence = null,
  correlationId = null,
  supersedesAttemptId = null,
  status = null,
}) {
  const id = newId();
  const attemptStatus =
    status ||
    (mode === 'double' ? 'preview' : ok ? 'accepted' : 'failed');
  // Prefer full integrity columns when migrated
  try {
    getDb()
      .prepare(
        `INSERT INTO submission_attempts (
           id, draft_id, user_id, mode, ok, results_json, created_at,
           evidence_json, correlation_id, supersedes_attempt_id, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        draftId,
        userId || null,
        mode,
        ok ? 1 : 0,
        JSON.stringify(results),
        new Date().toISOString(),
        evidence ? JSON.stringify(evidence) : null,
        correlationId || null,
        supersedesAttemptId || null,
        attemptStatus
      );
  } catch {
    getDb()
      .prepare(
        `INSERT INTO submission_attempts (id, draft_id, user_id, mode, ok, results_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        draftId,
        userId || null,
        mode,
        ok ? 1 : 0,
        JSON.stringify(results),
        new Date().toISOString()
      );
  }
  if (idempotencyKey) {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO idempotency_keys (key, user_id, response_json, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        idempotencyKey,
        userId || null,
        JSON.stringify({
          attemptId: id,
          ok,
          mode,
          draftId,
          results,
          correlationId,
        }),
        new Date().toISOString()
      );
  }
  return id;
}

/**
 * Load full receipt / evidence pack for a submission attempt.
 * @param {string} attemptId
 * @param {string|null} [userId]
 */
export function getSubmissionEvidence(attemptId, userId = null) {
  const row = getDb()
    .prepare(`SELECT * FROM submission_attempts WHERE id = ?`)
    .get(attemptId);
  if (!row) return null;
  if (userId && row.user_id && row.user_id !== userId) return null;
  let results = [];
  let evidence = null;
  try {
    results = JSON.parse(row.results_json);
  } catch {
    results = [];
  }
  try {
    evidence = row.evidence_json ? JSON.parse(row.evidence_json) : null;
  } catch {
    evidence = null;
  }
  return {
    id: row.id,
    draftId: row.draft_id,
    userId: row.user_id,
    mode: row.mode,
    ok: Boolean(row.ok),
    status: row.status || (row.mode === 'double' ? 'preview' : 'recorded'),
    correlationId: row.correlation_id || evidence?.correlationId || null,
    supersedesAttemptId: row.supersedes_attempt_id || null,
    createdAt: row.created_at,
    results,
    evidence,
  };
}

/**
 * Idempotency is scoped to user (and optional operation).
 * Global key lookup alone is forbidden for replay across users.
 * @param {string} key
 * @param {{ userId?: string|null, operation?: string }} [scope]
 */
export function getIdempotentResponse(key, scope = {}) {
  const row = getDb()
    .prepare(`SELECT * FROM idempotency_keys WHERE key = ?`)
    .get(key);
  if (!row) return null;
  const scopedUser = scope.userId != null ? String(scope.userId) : null;
  const rowUser = row.user_id != null ? String(row.user_id) : null;
  // Deny cross-user replay: stored user must match request scope user
  if (rowUser && scopedUser && rowUser !== scopedUser) {
    return null;
  }
  if (rowUser && !scopedUser) {
    return null;
  }
  if (!rowUser && scopedUser) {
    // Anonymous key cannot be replayed by a signed-in user
    return null;
  }
  return JSON.parse(row.response_json);
}

export function writeAudit({
  firmId = null,
  userId = null,
  action,
  entityType = null,
  entityId = null,
  meta = null,
}) {
  getDb()
    .prepare(
      `INSERT INTO audit_events (id, firm_id, user_id, action, entity_type, entity_id, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId(),
      firmId,
      userId,
      action,
      entityType,
      entityId,
      meta ? JSON.stringify(meta) : null,
      new Date().toISOString()
    );
}

/**
 * List audit events for a firm (no secrets/NINO in meta by convention).
 * @param {string} firmId
 * @param {number} [limit]
 */
export function listAuditForFirm(firmId, limit = 50) {
  return getDb()
    .prepare(
      `SELECT id, firm_id, user_id, action, entity_type, entity_id, meta_json, created_at
       FROM audit_events WHERE firm_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(firmId, limit)
    .map((r) => ({
      id: r.id,
      firmId: r.firm_id,
      userId: r.user_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      meta: r.meta_json ? JSON.parse(r.meta_json) : null,
      createdAt: r.created_at,
    }));
}

/**
 * @param {string} userId
 * @param {number} [limit]
 */
export function listAuditForUser(userId, limit = 30) {
  return getDb()
    .prepare(
      `SELECT id, firm_id, user_id, action, entity_type, entity_id, meta_json, created_at
       FROM audit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(userId, limit)
    .map((r) => ({
      id: r.id,
      firmId: r.firm_id,
      userId: r.user_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      meta: r.meta_json ? JSON.parse(r.meta_json) : null,
      createdAt: r.created_at,
    }));
}
