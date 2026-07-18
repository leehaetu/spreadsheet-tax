/**
 * Background job runner — separate process from web.
 * Usage: node src/workers/job-runner.js
 * Queues: excel, hmrc_submit (payload must include userApproved:true), email, reminders
 */

import crypto from 'node:crypto';
import {
  claimJob,
  completeJob,
  failJob,
  queueDepth,
} from '../lib/job-queue.js';
import { isPostgresMode } from '../lib/platform-config.js';
import { migratePostgres } from '../lib/pg-pool.js';
import { getDb } from '../lib/db.js';
import { ensureOperationalPostgres } from '../lib/operational-store.js';
import { performQueuedHmrcSubmit } from '../lib/live-submit.js';
import { processLocalFileIsolated } from '../lib/pipeline.js';
import { createDraft } from '../lib/drafts.js';
import { mirrorDraftToPostgres } from '../lib/operational-store.js';
import fs from 'node:fs';

const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
const queues = (process.env.WORKER_QUEUES || 'default,excel,hmrc_submit,email,reminders')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function handleJob(job) {
  switch (job.jobType) {
    case 'ping':
      return { pong: true, at: new Date().toISOString() };
    case 'deadline_reminders': {
      if (!job.payload?.firmId) {
        throw new Error('deadline_reminders requires firmId (no cross-tenant scan)');
      }
      const { runDeadlineReminders } = await import('../lib/jobs.js');
      return runDeadlineReminders(job.payload.withinDays || 14, {
        firmId: job.payload.firmId,
      });
    }
    case 'hmrc_submit': {
      // Real product submit — never autonomous without userApproved
      return performQueuedHmrcSubmit(job.payload || {});
    }
    case 'excel_parse': {
      const p = job.payload || {};
      if (!p.filePath && !p.bufferBase64) {
        throw new Error('excel_parse requires filePath or bufferBase64');
      }
      let buffer;
      if (p.bufferBase64) {
        buffer = Buffer.from(p.bufferBase64, 'base64');
      } else {
        buffer = fs.readFileSync(p.filePath);
      }
      const result = await processLocalFileIsolated(
        buffer,
        p.originalName || 'upload.xlsx'
      );
      const draft = createDraft({
        userId: p.userId || null,
        clientId: p.clientId || null,
        firmId: p.firmId || null,
        filename: p.originalName || 'upload.xlsx',
        payloads: {
          meta: result.payloads.meta,
          selfEmployment: result.payloads.selfEmployment,
          ukProperty: result.payloads.ukProperty,
          foreignProperty: result.payloads.foreignProperty,
        },
        summary: result.summary,
        figures: result.figures,
        validation: result.validation,
      });
      await mirrorDraftToPostgres(draft);
      return {
        draftId: draft.id,
        ok: true,
        sources: result.sources,
      };
    }
    default:
      throw new Error(`Unknown job type: ${job.jobType}`);
  }
}

async function tick() {
  for (const q of queues) {
    const job = await claimJob(q, workerId);
    if (!job) continue;
    try {
      const result = await handleJob(job);
      await completeJob(job.id, result);
      console.log(`[job-runner] completed ${job.jobType} ${job.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await failJob(job.id, msg);
      console.error(`[job-runner] failed ${job.id}:`, msg);
    }
  }
}

async function main() {
  if (isPostgresMode()) {
    await migratePostgres();
    await ensureOperationalPostgres();
    console.log('[job-runner] Postgres mode');
  } else {
    getDb();
    console.log('[job-runner] SQLite mode');
  }
  console.log(`[job-runner] ${workerId} queues=${queues.join(',')}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.error('[job-runner] tick error', e);
    }
    const depths = await Promise.all(queues.map((q) => queueDepth(q)));
    if (depths.some((d) => d > 0)) {
      await new Promise((r) => setTimeout(r, 200));
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
