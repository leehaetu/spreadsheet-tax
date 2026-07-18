/**
 * Submission integrity: figure lock, approval gate, evidence pack.
 * Product control — not marketing claims.
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import { newId } from './auth.js';
import { getMembership, ADMIN_ROLES } from './access-control.js';
import { ROLE_BOOKKEEPER } from './auth.js';

export const APPROVAL_WORDING =
  'I have checked the spreadsheet cells and mappings shown above. The cumulative figures displayed are the figures I authorise Spreadsheet Tax to send to HMRC.';

/**
 * Stable figure fingerprint for a server-owned payload set.
 * @param {object|null|undefined} payloads
 */
export function figureHash(payloads) {
  const canonical = JSON.stringify(sortKeys(payloads || {}));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sortKeys(value[k]);
    }
    return out;
  }
  return value;
}

/**
 * App correlation id for a submit/workflow attempt (not HMRC's).
 */
export function newCorrelationId() {
  return `st-${newId().replace(/-/g, '').slice(0, 24)}`;
}

/**
 * @param {string} draftId
 */
export function getLatestApproval(draftId) {
  if (!draftId) return null;
  const row = getDb()
    .prepare(
      `SELECT * FROM spreadsheet_reviews
       WHERE draft_id = ? AND approved = 1
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(draftId);
  if (!row) return null;
  let check = null;
  try {
    check = row.check_json ? JSON.parse(row.check_json) : null;
  } catch {
    check = null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    draftId: row.draft_id,
    fileSha256: row.file_sha256,
    figureHash: row.figure_hash || null,
    approverUserId: row.approver_user_id || row.user_id,
    approved: true,
    createdAt: row.created_at,
    check,
  };
}

/**
 * Record a figure-locked approval for a draft.
 * @param {{
 *   userId: string,
 *   draftId: string,
 *   payloads: object,
 *   fileSha256?: string|null,
 *   check?: object|null,
 *   firmId?: string|null,
 *   dualControl?: boolean,
 * }} opts
 */
export function recordDraftApproval(opts) {
  const fHash = figureHash(opts.payloads);
  // Dual control: bookkeeper preparer cannot self-approve on firm drafts
  if (opts.dualControl && opts.firmId) {
    const m = getMembership(opts.userId, opts.firmId);
    if (m && m.role === ROLE_BOOKKEEPER) {
      return {
        error:
          'Preparer (bookkeeper) cannot self-approve when dual control is required. A reviewer or practice admin must approve.',
        status: 403,
      };
    }
  }
  const id = newId();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO spreadsheet_reviews (
         id, user_id, draft_id, file_sha256, check_json, approved, created_at,
         figure_hash, approver_user_id
       ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .run(
      id,
      opts.userId,
      opts.draftId,
      opts.fileSha256 || opts.check?.fileSha256 || null,
      JSON.stringify(opts.check || { figureHash: fHash, wording: APPROVAL_WORDING }),
      now,
      fHash,
      opts.userId
    );
  return {
    ok: true,
    id,
    figureHash: fHash,
    approvedAt: now,
    wording: APPROVAL_WORDING,
  };
}

/**
 * Gate for /api/submit — every draft submit needs a matching approval.
 * Personal self-filers may approve in the same request via cellsApproved.
 * Live mode always requires approval; preview/double also requires it for draftId path.
 *
 * @param {{
 *   draft: object,
 *   user: { id: string }|null,
 *   payloads: object,
 *   body: object,
 *   mode: string,
 * }} opts
 * @returns {{ ok: true, approval: object, figureHash: string } | { error: string, status: number }}
 */
export function assertDraftSubmitApproval(opts) {
  const { draft, user, payloads, body } = opts;
  if (!draft) {
    return { error: 'Draft required for integrity-locked submit.', status: 400 };
  }
  const fHash = figureHash(payloads);
  const existing = getLatestApproval(draft.id);

  if (existing && existing.figureHash && existing.figureHash === fHash) {
    return { ok: true, approval: existing, figureHash: fHash };
  }
  // Legacy approvals without figure_hash: accept if approved and same draft
  if (existing && !existing.figureHash) {
    return {
      ok: true,
      approval: { ...existing, figureHash: fHash },
      figureHash: fHash,
    };
  }

  // In-request self-approval (UI checkbox → cellsApproved)
  const cellsApproved =
    body?.cellsApproved === true ||
    body?.cellsApproved === 'true' ||
    body?.cellsApproved === 1;
  if (cellsApproved && user) {
    const dual =
      Boolean(draft.firmId) &&
      process.env.PRACTICE_DUAL_CONTROL !== '0';
    const recorded = recordDraftApproval({
      userId: user.id,
      draftId: draft.id,
      payloads,
      fileSha256: body?.fileSha256 || draft.fileSha256 || null,
      check: body?.spreadsheetCheck || null,
      firmId: draft.firmId,
      dualControl: dual,
    });
    if (recorded.error) return recorded;
    return {
      ok: true,
      approval: {
        id: recorded.id,
        userId: user.id,
        draftId: draft.id,
        figureHash: recorded.figureHash,
        approverUserId: user.id,
        approved: true,
        createdAt: recorded.approvedAt,
      },
      figureHash: recorded.figureHash,
    };
  }
  // Anonymous / unsigned preview path: cellsApproved still required but
  // no durable approver identity (live external still blocked elsewhere).
  if (cellsApproved && !user) {
    return {
      ok: true,
      approval: {
        id: null,
        userId: null,
        draftId: draft.id,
        figureHash: fHash,
        approverUserId: null,
        approved: true,
        createdAt: new Date().toISOString(),
        ephemeral: true,
      },
      figureHash: fHash,
    };
  }

  return {
    error:
      'Approve the spreadsheet figures before submit. Confirm cells and mappings match the figures to send to HMRC.',
    status: 403,
    code: 'APPROVAL_REQUIRED',
    figureHash: fHash,
  };
}

/**
 * Build immutable evidence pack for a submission attempt.
 */
export function buildEvidencePack({
  correlationId,
  draft,
  payloads,
  approval,
  mode,
  results,
  mappingVersion = 'v1-deterministic',
  readback = null,
  supersedesAttemptId = null,
}) {
  const fHash = figureHash(payloads);
  return {
    version: 1,
    correlationId,
    recordedAt: new Date().toISOString(),
    draftId: draft?.id || null,
    filename: draft?.filename || null,
    fileSha256: approval?.fileSha256 || null,
    figureHash: fHash,
    mappingVersion,
    approverUserId: approval?.approverUserId || approval?.userId || null,
    approvalId: approval?.id || null,
    approvalAt: approval?.createdAt || null,
    approvalWording: APPROVAL_WORDING,
    mode,
    payloadsSnapshot: payloads,
    results,
    readback,
    supersedesAttemptId,
  };
}

/**
 * Whether firm dual control is enabled (default on when firm draft).
 */
export function firmRequiresDualControl(firmId) {
  if (!firmId) return false;
  if (process.env.PRACTICE_DUAL_CONTROL === '0') return false;
  return true;
}

export { ADMIN_ROLES };
