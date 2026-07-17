/**
 * Outbound email.
 * Default: stub (logs only). Set SMTP_URL or EMAIL_WEBHOOK_URL for delivery.
 * Always return { delivered: boolean } so callers never claim mail was sent when stubbed.
 */

/**
 * @param {{ to: string, subject: string, body: string, kind?: string }} msg
 * @returns {Promise<{ ok: boolean, delivered: boolean, provider: string, to: string, subject: string, kind: string, at: string, body?: string, error?: string }>}
 */
export async function sendEmail(msg) {
  const entry = {
    at: new Date().toISOString(),
    kind: msg.kind || 'generic',
    to: msg.to,
    subject: msg.subject,
    body: String(msg.body || '').slice(0, 2000),
  };

  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        throw new Error(`webhook status ${res.status}`);
      }
      return { ok: true, delivered: true, provider: 'webhook', ...entry };
    } catch (e) {
      console.error('[email-webhook-failed]', e);
      if (process.env.EMAIL_LOG !== '0') {
        console.log('[email-stub-fallback]', JSON.stringify(entry));
      }
      return {
        ok: false,
        delivered: false,
        provider: 'webhook-failed',
        error: e instanceof Error ? e.message : 'webhook failed',
        ...entry,
      };
    }
  }

  // Stub: never claim delivery
  if (process.env.EMAIL_LOG !== '0') {
    console.log('[email-stub]', JSON.stringify(entry));
  }
  return {
    ok: true,
    delivered: false,
    provider: 'stub',
    note: 'Email not delivered — configure EMAIL_WEBHOOK_URL for real send',
    ...entry,
  };
}

/**
 * @param {{ email: string, clientName: string, dueDate?: string }} opts
 */
export async function sendDeadlineReminder(opts) {
  return sendEmail({
    kind: 'deadline_reminder',
    to: opts.email,
    subject: `Quarterly update reminder: ${opts.clientName}`,
    body: `Reminder for ${opts.clientName}. Due: ${opts.dueDate || 'see workspace'}. Open Spreadsheet Tax to import and review.`,
  });
}

export function emailDeliveryMode() {
  if (process.env.EMAIL_WEBHOOK_URL) return 'webhook';
  return 'stub';
}
