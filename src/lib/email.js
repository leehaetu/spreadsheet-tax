/**
 * Email stub — logs outbound messages; swap for real provider later.
 */

/**
 * @param {{ to: string, subject: string, body: string, kind?: string }} msg
 */
export function sendEmail(msg) {
  const entry = {
    at: new Date().toISOString(),
    kind: msg.kind || 'generic',
    to: msg.to,
    subject: msg.subject,
    body: String(msg.body || '').slice(0, 2000),
  };
  if (process.env.EMAIL_LOG !== '0') {
    console.log('[email-stub]', JSON.stringify(entry));
  }
  return { ok: true, provider: 'stub', ...entry };
}

/**
 * @param {{ email: string, clientName: string, dueDate?: string }} opts
 */
export function sendDeadlineReminder(opts) {
  return sendEmail({
    kind: 'deadline_reminder',
    to: opts.email,
    subject: `Quarterly update reminder: ${opts.clientName}`,
    body: `Reminder for ${opts.clientName}. Due: ${opts.dueDate || 'see workspace'}. Open Spreadsheet Tax to import and review.`,
  });
}
