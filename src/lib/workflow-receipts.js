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
    },
  ];
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
  return {
    receiptId: id,
    workflow: opts.workflow,
    ok: Boolean(opts.ok),
    mode: opts.mode,
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
