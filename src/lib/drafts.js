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

export function recordSubmissionAttempt({
  draftId,
  userId,
  mode,
  ok,
  results,
}) {
  const id = newId();
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
  return id;
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
