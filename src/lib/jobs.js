/**
 * Lightweight in-process job runners (reminders, retention). Not for HMRC auto-retry.
 */

import { getDb } from './db.js';
import { sendDeadlineReminder } from './email.js';
import { newId } from './auth.js';

/**
 * Queue deadline reminders for clients with due dates within N days.
 * Email may be stubbed (delivered:false) unless EMAIL_WEBHOOK_URL is set.
 * @param {number} [withinDays]
 * @param {{ firmId?: string|null }} [opts] — when firmId set, only that firm
 */
export async function runDeadlineReminders(withinDays = 14, opts = {}) {
  const database = getDb();
  const today = new Date();
  const limit = new Date(today.getTime() + withinDays * 864e5)
    .toISOString()
    .slice(0, 10);
  const firmId = opts.firmId ? String(opts.firmId) : null;
  // Without firmId, return empty — never scan all tenants from a user route.
  if (!firmId && opts.requireFirm !== false) {
    return {
      ok: true,
      count: 0,
      deliveredCount: 0,
      sent: [],
      note: 'firmId required — cross-tenant reminder scan disabled',
    };
  }
  const clients = firmId
    ? database
        .prepare(
          `SELECT c.*, u.email AS owner_email FROM clients c
       LEFT JOIN users u ON u.id = c.assignee_user_id
       WHERE c.firm_id = ? AND c.due_date IS NOT NULL AND c.due_date <= ? AND c.workflow_status NOT IN ('submitted')`
        )
        .all(firmId, limit)
    : database
        .prepare(
          `SELECT c.*, u.email AS owner_email FROM clients c
       LEFT JOIN users u ON u.id = c.assignee_user_id
       WHERE c.due_date IS NOT NULL AND c.due_date <= ? AND c.workflow_status NOT IN ('submitted')`
        )
        .all(limit);

  const sent = [];
  for (const c of clients) {
    if (!c.owner_email) continue;
    const result = await sendDeadlineReminder({
      email: c.owner_email,
      clientName: c.display_name,
      dueDate: c.due_date,
    });
    sent.push({
      clientId: c.id,
      to: c.owner_email,
      ok: result.ok,
      delivered: result.delivered,
      provider: result.provider,
    });
    database
      .prepare(
        `INSERT INTO audit_events (id, firm_id, user_id, action, entity_type, entity_id, meta_json, created_at)
         VALUES (?, ?, NULL, 'deadline_reminder_queued', 'client', ?, ?, ?)`
      )
      .run(
        newId(),
        c.firm_id,
        c.id,
        JSON.stringify({
          dueDate: c.due_date,
          delivered: result.delivered,
          provider: result.provider,
        }),
        new Date().toISOString()
      );
  }
  return {
    ok: true,
    count: sent.length,
    deliveredCount: sent.filter((s) => s.delivered).length,
    sent,
  };
}

/**
 * Delete anonymous drafts older than maxAgeHours with no user.
 * @param {number} [maxAgeHours]
 */
export function purgeAnonymousDrafts(maxAgeHours = 48) {
  const database = getDb();
  const cutoff = new Date(Date.now() - maxAgeHours * 3600e3).toISOString();
  const result = database
    .prepare(
      `DELETE FROM drafts WHERE user_id IS NULL AND created_at < ?`
    )
    .run(cutoff);
  return { ok: true, deleted: result.changes || 0 };
}
