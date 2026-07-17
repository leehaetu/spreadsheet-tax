/**
 * Lightweight in-process job runners (reminders, retention). Not for HMRC auto-retry.
 */

import { getDb } from './db.js';
import { sendDeadlineReminder } from './email.js';
import { newId } from './auth.js';

/**
 * Send stub reminders for clients with due dates within N days.
 * @param {number} [withinDays]
 */
export function runDeadlineReminders(withinDays = 14) {
  const database = getDb();
  const today = new Date();
  const limit = new Date(today.getTime() + withinDays * 864e5)
    .toISOString()
    .slice(0, 10);
  const clients = database
    .prepare(
      `SELECT c.*, u.email AS owner_email FROM clients c
       LEFT JOIN users u ON u.id = c.assignee_user_id
       WHERE c.due_date IS NOT NULL AND c.due_date <= ? AND c.workflow_status NOT IN ('submitted')`
    )
    .all(limit);

  const sent = [];
  for (const c of clients) {
    if (!c.owner_email) continue;
    const result = sendDeadlineReminder({
      email: c.owner_email,
      clientName: c.display_name,
      dueDate: c.due_date,
    });
    sent.push({ clientId: c.id, to: c.owner_email, ok: result.ok });
    database
      .prepare(
        `INSERT INTO audit_events (id, firm_id, user_id, action, entity_type, entity_id, meta_json, created_at)
         VALUES (?, ?, NULL, 'deadline_reminder_sent', 'client', ?, ?, ?)`
      )
      .run(
        newId(),
        c.firm_id,
        c.id,
        JSON.stringify({ dueDate: c.due_date }),
        new Date().toISOString()
      );
  }
  return { ok: true, count: sent.length, sent };
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
      `DELETE FROM drafts WHERE user_id IS NULL AND created_at < ? AND state != 'submitted'`
    )
    .run(cutoff);
  return { ok: true, deleted: result.changes ?? 0 };
}
