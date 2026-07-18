/**
 * Immutable local receipts for every HMRC/product workflow attempt.
 * Same store as quarterly submit attempts — one receipt model.
 */

import { getDb } from './db.js';
import { newId } from './auth.js';

/**
 * @param {{
 *   userId: string|null,
 *   draftId?: string|null,
 *   workflow: string,
 *   mode: string,
 *   ok: boolean,
 *   request?: object,
 *   response?: object,
 *   hmrcStatus?: number|null,
 *   hmrcCode?: string|null,
 *   path?: string|null,
 * }} opts
 */
export function recordWorkflowReceipt(opts) {
  const id = newId();
  const correlationId = opts.correlationId || `st-wf-${id.replace(/-/g, '').slice(0, 16)}`;
  const results = [
    {
      workflow: opts.workflow,
      ok: Boolean(opts.ok),
      mode: opts.mode,
      hmrcStatus: opts.hmrcStatus ?? null,
      hmrcCode: opts.hmrcCode ?? null,
      path: opts.path ?? null,
      request: opts.request ?? null,
      response: opts.response ?? null,
      readback: opts.readback ?? null,
      correlationId,
      figureHash: opts.figureHash || null,
      mappingVersion: opts.mappingVersion || 'v1-deterministic',
      fileSha256: opts.fileSha256 || null,
      approverUserId: opts.approverUserId || null,
    },
  ];
  const evidence = {
    version: 1,
    correlationId,
    workflow: opts.workflow,
    figureHash: opts.figureHash || null,
    mappingVersion: opts.mappingVersion || 'v1-deterministic',
    fileSha256: opts.fileSha256 || null,
    approverUserId: opts.approverUserId || null,
    request: opts.request ?? null,
    response: opts.response ?? null,
    readback: opts.readback ?? null,
    supersedesAttemptId: opts.supersedesAttemptId || null,
  };
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
        opts.draftId || null,
        opts.userId || null,
        opts.mode || 'double',
        opts.ok ? 1 : 0,
        JSON.stringify(results),
        new Date().toISOString(),
        JSON.stringify(evidence),
        correlationId,
        opts.supersedesAttemptId || null,
        opts.ok ? 'accepted' : 'failed'
      );
  } catch {
    getDb()
      .prepare(
        `INSERT INTO submission_attempts (id, draft_id, user_id, mode, ok, results_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        opts.draftId || null,
        opts.userId || null,
        opts.mode || 'double',
        opts.ok ? 1 : 0,
        JSON.stringify(results),
        new Date().toISOString()
      );
  }
  return {
    receiptId: id,
    workflow: opts.workflow,
    ok: Boolean(opts.ok),
    mode: opts.mode,
    correlationId,
  };
}

/**
 * Extract status/code from our hmrcFetch-shaped result.
 * @param {object} result
 */
export function summariseHmrcResult(result) {
  const status = result?.status ?? result?.httpStatus ?? null;
  const body = result?.body;
  const code =
    (body && typeof body === 'object' && (body.code || body.validationCode)) ||
    result?.code ||
    null;
  const ok = Number(status) >= 200 && Number(status) < 300;
  return {
    ok,
    hmrcStatus: status,
    hmrcCode: code,
    path: result?.path || null,
    body,
  };
}
