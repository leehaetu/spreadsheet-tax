/**
 * Operational live (or preview) quarterly submit for SE + UK + foreign.
 * Used by HTTP /api/submit and hmrc_submit worker — same gates.
 */

import { createHmrcClient } from './hmrc-client.js';
import { validateSubmission } from './validation.js';
import {
  assertDraftSubmitApproval,
  buildEvidencePack,
  newCorrelationId,
  figureHash,
  getLatestApproval,
} from './submission-integrity.js';
import {
  getDraft,
  markDraftSubmitted,
  recordSubmissionAttempt,
  writeAudit,
} from './drafts.js';
import {
  getActiveConnection,
  isMockAccessToken,
} from './hmrc-oauth.js';
import {
  getDraftFromPostgres,
  mirrorDraftToPostgres,
  mirrorSubmissionAttemptToPostgres,
} from './operational-store.js';
import { isPostgresMode } from './platform-config.js';

/**
 * @param {{
 *   draftId: string,
 *   userId: string|null,
 *   body: object,
 *   req?: import('express').Request|null,
 *   accessToken?: string|null,
 *   forceDouble?: boolean,
 * }} opts
 */
export async function performProductSubmit(opts) {
  let draft = getDraft(opts.draftId);
  // Prefer Postgres SoR when configured (never fail the request if PG is down)
  if (isPostgresMode()) {
    try {
      const pgDraft = await getDraftFromPostgres(opts.draftId);
      if (pgDraft) draft = pgDraft;
    } catch (e) {
      console.warn(
        '[live-submit] PG draft read failed, using local store',
        e instanceof Error ? e.message : e
      );
    }
  }
  if (!draft) {
    return { error: 'Draft not found', status: 404 };
  }
  if (draft.userId && opts.userId && draft.userId !== opts.userId) {
    return { error: 'Not allowed to use this draft.', status: 403 };
  }

  const payloads = draft.payloads;
  const approvalGate = assertDraftSubmitApproval({
    draft,
    user: opts.userId ? { id: opts.userId } : null,
    payloads,
    body: opts.body || {},
    mode: 'pending',
  });
  if (approvalGate.error) {
    return {
      error: approvalGate.error,
      status: approvalGate.status || 403,
      code: approvalGate.code || 'APPROVAL_REQUIRED',
      figureHash: approvalGate.figureHash,
    };
  }

  const validation = validateSubmission(payloads, {
    nino: opts.body?.nino,
    businessIdSe: opts.body?.businessIdSe,
    businessIdUk: opts.body?.businessIdUk,
    businessIdForeign: opts.body?.businessIdForeign,
    taxYear: opts.body?.taxYear,
  });
  if (!validation.ready) {
    return {
      error: 'Check the submission details before continuing.',
      status: 422,
      validation,
    };
  }

  let accessToken = opts.accessToken || null;
  let connectionMock = false;
  const allowLive =
    !opts.forceDouble && process.env.HMRC_ALLOW_LIVE_SUBMIT === '1';
  // Live mode label always from env (production vs sandbox) — never left undefined
  // when a pre-supplied accessToken is used (HTTP path passes token in).
  const liveMode =
    process.env.HMRC_OAUTH_ENV === 'production' ? 'production' : 'sandbox';

  if (allowLive && opts.userId && !accessToken) {
    const conn = getActiveConnection(opts.userId);
    if (conn && !conn.expired && conn.accessToken) {
      if (conn.mock || isMockAccessToken(conn.accessToken)) {
        return {
          error:
            'HMRC connection is a local mock for UI testing only. Connect real HMRC OAuth before external submit.',
          status: 403,
          mockConnection: true,
        };
      }
      accessToken = conn.accessToken;
      connectionMock = false;
    }
  }

  if (!allowLive || !accessToken) {
    // Preview path
    const client = createHmrcClient({
      mode: 'double',
      accessToken: undefined,
      clientId: undefined,
      clientSecret: undefined,
      req: opts.req || null,
      userId: opts.userId || null,
    });
    const results = await client.submitBundle(payloads, {
      nino: validation.normalized.nino,
      businessIdSe: validation.normalized.businessIdSe || opts.body?.businessIdSe,
      businessIdUk: validation.normalized.businessIdUk || opts.body?.businessIdUk,
      businessIdForeign:
        validation.normalized.businessIdForeign || opts.body?.businessIdForeign,
      taxYear: validation.normalized.taxYear,
    });
    return finalize({
      draft,
      userId: opts.userId,
      results,
      mode: 'double',
      approval: approvalGate.approval,
      payloads,
      connectionMock: false,
      externalCallMade: false,
      supersedesAttemptId: opts.body?.supersedesAttemptId,
      idempotencyKey: opts.body?.idempotencyKey,
    });
  }

  // Live external path — real token required; mode from HMRC_OAUTH_ENV only
  const client = createHmrcClient({
    mode: liveMode,
    accessToken,
    req: opts.req || null,
    userId: opts.userId || null,
  });
  if (client.mode === 'double') {
    return {
      error: 'Live HMRC client resolved to preview — check credentials.',
      status: 503,
    };
  }
  const results = await client.submitBundle(payloads, {
    nino: validation.normalized.nino,
    businessIdSe: validation.normalized.businessIdSe || opts.body?.businessIdSe,
    businessIdUk: validation.normalized.businessIdUk || opts.body?.businessIdUk,
    businessIdForeign:
      validation.normalized.businessIdForeign || opts.body?.businessIdForeign,
    taxYear: validation.normalized.taxYear,
  });
  const externalCallMade = results.some((r) => r.externalCallMade === true);
  return finalize({
    draft,
    userId: opts.userId,
    results,
    mode: client.mode,
    approval: approvalGate.approval,
    payloads,
    connectionMock,
    externalCallMade,
    supersedesAttemptId: opts.body?.supersedesAttemptId,
    idempotencyKey: opts.body?.idempotencyKey,
  });
}

function finalize({
  draft,
  userId,
  results,
  mode,
  approval,
  payloads,
  connectionMock,
  externalCallMade,
  supersedesAttemptId,
  idempotencyKey,
}) {
  const ok = results.every((r) => r.ok);
  const correlationId = newCorrelationId();
  if (ok) markDraftSubmitted(draft.id);
  const evidence = buildEvidencePack({
    correlationId,
    draft,
    payloads,
    approval,
    mode,
    results,
    mappingVersion: 'v1-deterministic',
    supersedesAttemptId: supersedesAttemptId || null,
  });
  const attemptId = recordSubmissionAttempt({
    draftId: draft.id,
    userId,
    mode,
    ok,
    results,
    idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
    evidence,
    correlationId,
    supersedesAttemptId: supersedesAttemptId || null,
    status: mode === 'double' ? 'preview' : ok ? 'accepted' : 'failed',
  });
  writeAudit({
    userId: userId || null,
    action: ok ? 'submit_ok' : 'submit_failed',
    entityType: 'draft',
    entityId: draft.id,
    meta: {
      mode,
      attemptId,
      correlationId,
      figureHash: approval?.figureHash || figureHash(payloads),
      externalCallMade,
      previewOnly: mode === 'double',
    },
  });
  // SoR dual-write (async fire from sync finalize — caller may await via performProductSubmit tail)
  const mirrorPromise = Promise.all([
    mirrorDraftToPostgres(draft),
    mirrorSubmissionAttemptToPostgres({
      id: attemptId,
      draftId: draft.id,
      userId,
      mode,
      ok,
      results,
      evidence,
      correlationId,
      supersedesAttemptId,
      status: mode === 'double' ? 'preview' : ok ? 'accepted' : 'failed',
      createdAt: new Date().toISOString(),
    }),
  ]).catch(() => {});
  return {
    ok,
    mode,
    draftId: draft.id,
    attemptId,
    correlationId,
    figureHash: approval?.figureHash || figureHash(payloads),
    liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
    previewOnly: mode === 'double',
    externalCallMade,
    fraudHeadersPrepared: true,
    fraudHeadersSentToHmrc: externalCallMade,
    connectionMock,
    results,
    evidenceUrl: `/api/receipts/${encodeURIComponent(attemptId)}/evidence`,
    _mirrorPromise: mirrorPromise,
  };
}

/**
 * Worker entry: requires userApproved flag AND a durable figure-hash approval
 * already stored for the draft. Does NOT re-self-approve via cellsApproved.
 * @param {object} payload
 */
export async function performQueuedHmrcSubmit(payload) {
  if (payload?.userApproved !== true) {
    throw new Error(
      'hmrc_submit rejected: userApproved must be true (no autonomous filing)'
    );
  }
  if (!payload.draftId) {
    throw new Error('hmrc_submit requires draftId');
  }
  const draft = getDraft(payload.draftId);
  if (!draft) {
    throw new Error('hmrc_submit: draft not found');
  }
  const approval = getLatestApproval(payload.draftId);
  if (!approval) {
    throw new Error(
      'hmrc_submit rejected: no durable figure approval on draft (approve before queue)'
    );
  }
  const currentHash = figureHash(draft.payloads);
  if (approval.figureHash && approval.figureHash !== currentHash) {
    throw new Error(
      'hmrc_submit rejected: figures changed since approval — re-approve required'
    );
  }
  // Pass empty body without cellsApproved — rely on durable approval only
  const result = await performProductSubmit({
    draftId: payload.draftId,
    userId: payload.userId || null,
    body: {
      nino: payload.nino,
      taxYear: payload.taxYear,
      businessIdSe: payload.businessIdSe,
      businessIdUk: payload.businessIdUk,
      businessIdForeign: payload.businessIdForeign,
      // Explicitly do NOT set cellsApproved — must use stored approval
      supersedesAttemptId: payload.supersedesAttemptId,
      idempotencyKey: payload.idempotencyKey,
    },
    accessToken: payload.accessToken || null,
    forceDouble: payload.forceDouble === true,
  });
  if (result.error) {
    const err = new Error(result.error);
    // @ts-ignore
    err.status = result.status;
    throw err;
  }
  if (result._mirrorPromise) await result._mirrorPromise;
  return result;
}
