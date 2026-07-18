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
      // Firm-scoped only — payload.firmId required
      if (!job.payload?.firmId) {
        throw new Error('deadline_reminders requires firmId (no cross-tenant scan)');
      }
      const { runDeadlineReminders } = await import('../lib/jobs.js');
      return runDeadlineReminders(job.payload.withinDays || 14, {
        firmId: job.payload.firmId,
      });
    }
    case 'hmrc_submit': {
      // Hard gate: never autonomous HMRC submit without explicit approval flag
      if (job.payload?.userApproved !== true) {
        throw new Error(
          'hmrc_submit rejected: userApproved must be true (no autonomous filing)'
        );
      }
      return {
        queued: true,
        note: 'HMRC submit worker placeholder — uses same adapter when wired to draftId',
        draftId: job.payload.draftId,
      };
    }
    case 'excel_parse':
      return { note: 'excel parse handled on upload path via isolated worker' };
    default:
      throw new Error(`Unknown job type: ${job.jobType}`);
  }
}

async function tick() {
  for (const q of queues) {
    const job = await claimJob(q, workerId);
    if (!job) continue;
    try {
      await handleJob(job);
      await completeJob(job.id);
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
