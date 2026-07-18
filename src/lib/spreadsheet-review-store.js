/**
 * Persist last spreadsheet check + preparer cell comments.
 */

import { getDb } from './db.js';
import { newId } from './auth.js';

/**
 * @param {{ userId: string, draftId?: string|null, fileSha256?: string|null, check: object, approved?: boolean }} opts
 */
export function saveSpreadsheetReview(opts) {
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO spreadsheet_reviews (id, user_id, draft_id, file_sha256, check_json, approved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      opts.userId,
      opts.draftId || null,
      opts.fileSha256 || null,
      JSON.stringify(opts.check),
      opts.approved ? 1 : 0,
      new Date().toISOString()
    );
  return { id };
}

/**
 * Previous check for re-upload comparison (same user, most recent).
 * @param {string} userId
 * @param {string|null} [excludeDraftId]
 */
export function getPreviousSpreadsheetCheck(userId, excludeDraftId = null) {
  const row = excludeDraftId
    ? getDb()
        .prepare(
          `SELECT * FROM spreadsheet_reviews WHERE user_id = ? AND (draft_id IS NULL OR draft_id != ?)
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(userId, excludeDraftId)
    : getDb()
        .prepare(
          `SELECT * FROM spreadsheet_reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
        )
        .get(userId);
  if (!row) return null;
  try {
    return JSON.parse(row.check_json);
  } catch {
    return null;
  }
}

/**
 * @param {{ userId: string, draftId?: string|null, firmId?: string|null, cellRef: string, sheet?: string, rangeRef?: string, body: string, authorRole?: string }} opts
 */
export function addCellComment(opts) {
  const body = String(opts.body || '').trim().slice(0, 2000);
  if (!body) return { error: 'Comment body required', status: 400 };
  const cellRef = String(opts.cellRef || '').trim().slice(0, 80);
  if (!cellRef) return { error: 'cellRef required', status: 400 };
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO cell_comments (id, user_id, draft_id, firm_id, cell_ref, sheet, range_ref, body, author_role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      opts.userId,
      opts.draftId || null,
      opts.firmId || null,
      cellRef,
      opts.sheet || null,
      opts.rangeRef || null,
      body,
      opts.authorRole || 'preparer',
      new Date().toISOString()
    );
  return {
    ok: true,
    comment: {
      id,
      cellRef,
      body,
      authorRole: opts.authorRole || 'preparer',
    },
  };
}

/**
 * @param {string} draftId
 */
export function listCellComments(draftId) {
  return getDb()
    .prepare(
      `SELECT id, user_id, draft_id, cell_ref, sheet, range_ref, body, author_role, created_at
       FROM cell_comments WHERE draft_id = ? ORDER BY created_at ASC`
    )
    .all(draftId)
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      draftId: r.draft_id,
      cellRef: r.cell_ref,
      sheet: r.sheet,
      rangeRef: r.range_ref,
      body: r.body,
      authorRole: r.author_role,
      createdAt: r.created_at,
    }));
}
