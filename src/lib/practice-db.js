/**
 * Persistent practice clients (tenant-scoped). Complements demo practice-store.
 */

import { getDb } from './db.js';
import { newId, userCanAccessFirm } from './auth.js';
import {
  assertClientMutator,
  assertPracticeAdmin,
} from './access-control.js';

/** Full practice pipeline (design language). */
const TRANSITIONS = {
  not_started: ['awaiting_records'],
  awaiting_records: ['processing', 'records_received', 'mapping_required'],
  records_received: ['processing', 'mapping_required', 'needs_review'],
  processing: ['needs_mapping', 'mapping_required', 'ready_for_preparation', 'client_query'],
  needs_mapping: ['ready_for_preparation', 'client_query', 'mapping_required'],
  mapping_required: ['needs_review', 'ready_for_preparation', 'client_query'],
  needs_review: [
    'ready_for_preparation',
    'ready_for_approval',
    'awaiting_reviewer',
    'client_query',
    'ready_to_submit',
  ],
  client_query: ['records_received', 'processing', 'needs_review', 'awaiting_records'],
  ready_for_preparation: ['awaiting_reviewer', 'ready_for_approval', 'client_query'],
  awaiting_reviewer: ['ready_for_approval', 'awaiting_client_approval', 'needs_review'],
  ready_for_approval: ['awaiting_client_approval', 'ready_to_submit', 'needs_review'],
  awaiting_client_approval: ['ready_to_submit', 'needs_review', 'client_query'],
  ready_to_submit: ['queued', 'submitted', 'needs_review'],
  queued: ['submitted', 'ready_to_submit'],
  submitted: ['hmrc_rejected', 'rejected', 'correction_required', 'year_complete'],
  hmrc_rejected: ['correction_required', 'needs_review'],
  rejected: ['correction_required', 'needs_review'],
  correction_required: ['mapping_required', 'needs_review', 'processing'],
  year_complete: [],
};

const LABELS = {
  not_started: 'Not started',
  awaiting_records: 'Awaiting records',
  records_received: 'Records received',
  processing: 'Processing',
  needs_mapping: 'Needs mapping',
  mapping_required: 'Mapping required',
  needs_review: 'Needs review',
  client_query: 'Client query',
  ready_for_preparation: 'Ready for preparation',
  awaiting_reviewer: 'Awaiting reviewer',
  ready_for_approval: 'Ready for approval',
  awaiting_client_approval: 'Awaiting client approval',
  ready_to_submit: 'Ready to submit',
  queued: 'Queued',
  submitted: 'Submitted',
  hmrc_rejected: 'HMRC rejected',
  rejected: 'Rejected',
  correction_required: 'Correction required',
  year_complete: 'Year complete',
};

/** Statuses that typically need practice attention (not terminal success). */
const NEEDS_ACTION = new Set([
  'not_started',
  'awaiting_records',
  'records_received',
  'processing',
  'needs_mapping',
  'mapping_required',
  'needs_review',
  'client_query',
  'ready_for_preparation',
  'awaiting_reviewer',
  'ready_for_approval',
  'awaiting_client_approval',
  'ready_to_submit',
  'queued',
  'hmrc_rejected',
  'rejected',
  'correction_required',
]);

/** Human next-action labels for UI (not raw “Advance”). */
export function nextActionLabel(fromStatus, toStatus) {
  const map = {
    awaiting_records: 'Mark records received',
    processing: 'Start processing',
    needs_mapping: 'Flag mapping needed',
    ready_for_preparation: 'Send to preparer',
    awaiting_reviewer: 'Send to reviewer',
    awaiting_client_approval: 'Request client approval',
    ready_to_submit: 'Mark ready to submit',
    queued: 'Queue for HMRC',
    submitted: 'Mark submitted',
    client_query: 'Raise client query',
    year_complete: 'Mark year complete',
  };
  return map[toStatus] || `Move to ${LABELS[toStatus] || toStatus}`;
}

export function listAllowedTransitions(status) {
  return (TRANSITIONS[status] || []).map((id) => ({
    id,
    label: LABELS[id] || id,
    actionLabel: nextActionLabel(status, id),
  }));
}

export function listWorkflowStatusCatalog() {
  return Object.entries(LABELS).map(([id, label]) => ({ id, label }));
}

export function listFirmsForUser(userId) {
  return getDb()
    .prepare(
      `SELECT f.* FROM firms f
       JOIN firm_memberships m ON m.firm_id = f.id
       WHERE m.user_id = ?`
    )
    .all(userId);
}

export function listClients(firmId) {
  return getDb()
    .prepare(
      `SELECT * FROM clients WHERE firm_id = ? ORDER BY display_name`
    )
    .all(firmId)
    .map(mapClient);
}

/**
 * Paginated client list for large firm books (does not load full firm into memory).
 * @param {{
 *   firmId: string,
 *   q?: string,
 *   status?: string,
 *   needsAction?: boolean,
 *   limit?: number,
 *   offset?: number,
 * }} opts
 */
export function listClientsPage({
  firmId,
  q = '',
  status = '',
  needsAction = false,
  limit = 50,
  offset = 0,
}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const skip = Math.max(Number(offset) || 0, 0);
  const today = new Date().toISOString().slice(0, 10);
  const clauses = ['firm_id = ?'];
  /** @type {unknown[]} */
  const params = [firmId];
  if (status) {
    clauses.push('workflow_status = ?');
    params.push(status);
  }
  const query = String(q || '').trim();
  if (query) {
    clauses.push('LOWER(display_name) LIKE ?');
    params.push(`%${query.toLowerCase()}%`);
  }
  if (needsAction) {
    clauses.push(
      `(workflow_status != 'submitted' AND (
         workflow_status IN (${[...NEEDS_ACTION].map(() => '?').join(',')})
         OR (due_date IS NOT NULL AND due_date < ?)
       ))`
    );
    params.push(...NEEDS_ACTION, today);
  }
  const where = clauses.join(' AND ');
  const total = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM clients WHERE ${where}`)
    .get(...params).c;
  const rows = getDb()
    .prepare(
      `SELECT * FROM clients WHERE ${where}
       ORDER BY
         CASE WHEN due_date IS NOT NULL AND due_date < ? AND workflow_status != 'submitted' THEN 0 ELSE 1 END,
         due_date IS NULL, due_date, display_name
       LIMIT ? OFFSET ?`
    )
    .all(...params, today, take, skip);
  return {
    clients: rows.map(mapClient),
    total: Number(total) || 0,
    limit: take,
    offset: skip,
    hasMore: skip + rows.length < total,
  };
}

export function getClientRow(clientId) {
  const row = getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId);
  return row ? mapClient(row) : null;
}

function mapClient(row) {
  const status = row.workflow_status;
  return {
    id: row.id,
    firmId: row.firm_id,
    name: row.display_name,
    status,
    statusLabel: LABELS[status] || status,
    assigneeUserId: row.assignee_user_id,
    dueDate: row.due_date,
    portalAccess: Boolean(row.portal_enabled),
    portalToken: row.portal_token || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    transitions: listAllowedTransitions(status),
    needsAction: NEEDS_ACTION.has(status),
  };
}

function mirrorClientWrite(client) {
  if (!client?.id) return;
  import('./operational-store.js')
    .then((m) => m.scheduleMirror(() => m.mirrorClientToPostgres(client)))
    .catch(() => {});
}

/** @deprecated prefer listAllowedTransitions — kept for callers expecting {id,label} */
export function allowedTransitions(status) {
  return listAllowedTransitions(status);
}

/**
 * Create a portal invite token for a client (firm-scoped).
 * @param {{ clientId: string, userId: string }} opts
 */
export function createPortalInvite({ clientId, userId }) {
  const client = getClientRow(clientId);
  if (!client) return { error: 'Client not found', status: 404 };
  if (!userCanAccessFirm(userId, client.firmId)) {
    return { error: 'Not allowed for this firm.', status: 403 };
  }
  const token = newId().replace(/-/g, '');
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO portal_invites (token, client_id, firm_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, NULL)`
    )
    .run(token, clientId, client.firmId, now);
  getDb()
    .prepare(`UPDATE clients SET portal_token = ?, updated_at = ? WHERE id = ?`)
    .run(token, now, clientId);
  return {
    ok: true,
    token,
    path: `/portal?token=${token}`,
    client,
  };
}

/**
 * @param {string} token
 */
export function getClientByPortalToken(token) {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT c.*, f.name AS firm_name FROM clients c
       JOIN firms f ON f.id = c.firm_id
       WHERE c.portal_token = ? OR c.id IN (SELECT client_id FROM portal_invites WHERE token = ?)`
    )
    .get(token, token);
  if (!row) return null;
  return {
    ...mapClient(row),
    firmName: row.firm_name,
  };
}

/**
 * @param {{ clientId: string, userId: string, dueDate?: string|null, displayName?: string }} opts
 */
export function updateClientDetails({ clientId, userId, dueDate, displayName }) {
  const client = getClientRow(clientId);
  if (!client) return { error: 'Client not found', status: 404 };
  if (!userCanAccessFirm(userId, client.firmId)) {
    return { error: 'Not allowed for this firm.', status: 403 };
  }
  const now = new Date().toISOString();
  const name = displayName != null ? String(displayName).trim() : client.name;
  const due =
    dueDate === undefined
      ? client.dueDate
      : dueDate === '' || dueDate === null
        ? null
        : String(dueDate).slice(0, 10);
  if (!name) return { error: 'Client name required.', status: 400 };
  getDb()
    .prepare(
      `UPDATE clients SET display_name = ?, due_date = ?, updated_at = ? WHERE id = ?`
    )
    .run(name, due, now, clientId);
  const updated = getClientRow(clientId);
  mirrorClientWrite(updated);
  return { client: updated };
}

/**
 * CSV export of firm clients for practice reporting.
 * @param {string} firmId
 */
/**
 * Invite an email to join a firm with a role.
 * @param {{ firmId: string, email: string, role: string, invitedBy: string }} opts
 */
export function createFirmInvite({ firmId, email, role, invitedBy }) {
  const denied = assertPracticeAdmin(invitedBy, firmId);
  if (denied) return denied;
  const allowedRoles = ['bookkeeper', 'accountant', 'practice_admin'];
  if (!allowedRoles.includes(role)) {
    return { error: 'Invalid role.', status: 400 };
  }
  const normalized = String(email).trim().toLowerCase();
  if (!normalized.includes('@')) {
    return { error: 'Valid email required.', status: 400 };
  }
  const token = newId().replace(/-/g, '');
  getDb()
    .prepare(
      `INSERT INTO firm_invites (token, firm_id, email, role, invited_by, created_at, accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(
      token,
      firmId,
      normalized,
      role,
      invitedBy,
      new Date().toISOString()
    );
  return {
    ok: true,
    token,
    email: normalized,
    role,
    path: `/accept-invite?token=${token}`,
  };
}

/**
 * @param {string} token
 * @param {string} userId
 * @param {string} userEmail
 */
export function acceptFirmInvite(token, userId, userEmail) {
  const row = getDb()
    .prepare(`SELECT * FROM firm_invites WHERE token = ?`)
    .get(token);
  if (!row || row.accepted_at) {
    return { error: 'Invalid or already used invite.', status: 400 };
  }
  if (row.email !== String(userEmail).trim().toLowerCase()) {
    return {
      error: 'Sign in with the invited email address to accept.',
      status: 403,
    };
  }
  const existing = getDb()
    .prepare(
      `SELECT 1 FROM firm_memberships WHERE firm_id = ? AND user_id = ?`
    )
    .get(row.firm_id, userId);
  if (!existing) {
    getDb()
      .prepare(
        `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, ?)`
      )
      .run(newId(), row.firm_id, userId, row.role);
  }
  getDb()
    .prepare(`UPDATE firm_invites SET accepted_at = ? WHERE token = ?`)
    .run(new Date().toISOString(), token);
  return { ok: true, firmId: row.firm_id, role: row.role };
}

export function exportClientsCsv(firmId, { maxRows = 100_000 } = {}) {
  const cap = Math.min(Math.max(Number(maxRows) || 100_000, 1), 500_000);
  const clients = getDb()
    .prepare(
      `SELECT * FROM clients WHERE firm_id = ? ORDER BY display_name LIMIT ?`
    )
    .all(firmId, cap)
    .map(mapClient);
  const header = 'client_id,name,status,status_label,due_date,portal_access\n';
  const rows = clients
    .map((c) =>
      [
        c.id,
        `"${String(c.name).replace(/"/g, '""')}"`,
        c.status,
        `"${String(c.statusLabel || '').replace(/"/g, '""')}"`,
        c.dueDate || '',
        c.portalAccess ? 'yes' : 'no',
      ].join(',')
    )
    .join('\n');
  return header + rows + (rows ? '\n' : '');
}

/**
 * Firm portfolio summary using SQL aggregates (safe for large books).
 * @param {string} firmId
 */
export function getPracticeDashboard(firmId) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const soon = addDays(today, 14);
  const totalClients =
    db.prepare(`SELECT COUNT(*) AS c FROM clients WHERE firm_id = ?`).get(firmId)
      .c || 0;
  const byStatus = {};
  for (const id of Object.keys(LABELS)) byStatus[id] = 0;
  const statusRows = db
    .prepare(
      `SELECT workflow_status AS status, COUNT(*) AS c
       FROM clients WHERE firm_id = ? GROUP BY workflow_status`
    )
    .all(firmId);
  for (const r of statusRows) byStatus[r.status] = r.c;
  const overdue =
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM clients
         WHERE firm_id = ? AND due_date IS NOT NULL AND due_date < ?
           AND workflow_status != 'submitted'`
      )
      .get(firmId, today).c || 0;
  const dueSoon =
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM clients
         WHERE firm_id = ? AND due_date IS NOT NULL
           AND due_date >= ? AND due_date <= ?
           AND workflow_status != 'submitted'`
      )
      .get(firmId, today, soon).c || 0;
  const needsActionStatuses = [...NEEDS_ACTION];
  const needsActionCount =
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM clients
         WHERE firm_id = ? AND workflow_status != 'submitted' AND (
           workflow_status IN (${needsActionStatuses.map(() => '?').join(',')})
           OR (due_date IS NOT NULL AND due_date < ?)
         )`
      )
      .get(firmId, ...needsActionStatuses, today).c || 0;
  const needsActionRows = db
    .prepare(
      `SELECT * FROM clients
       WHERE firm_id = ? AND workflow_status != 'submitted' AND (
         workflow_status IN (${needsActionStatuses.map(() => '?').join(',')})
         OR (due_date IS NOT NULL AND due_date < ?)
       )
       ORDER BY
         CASE WHEN due_date IS NOT NULL AND due_date < ? THEN 0 ELSE 1 END,
         due_date IS NULL, due_date, display_name
       LIMIT 50`
    )
    .all(firmId, ...needsActionStatuses, today, today);
  const needsAction = needsActionRows.map((row) => {
    const c = mapClient(row);
    const isOverdue = Boolean(c.dueDate && c.dueDate < today && c.status !== 'submitted');
    return {
      ...c,
      overdue: isOverdue,
      reason: isOverdue ? 'Overdue' : LABELS[c.status] || c.status,
    };
  });
  return {
    totalClients: Number(totalClients) || 0,
    byStatus,
    overdue: Number(overdue) || 0,
    dueSoon: Number(dueSoon) || 0,
    needsActionCount: Number(needsActionCount) || 0,
    needsAction,
  };
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Create a practice firm and make the user practice_admin.
 * @param {{ userId: string, name: string, type?: string }} opts
 */
export function createFirm({ userId, name, type = 'accountancy' }) {
  const n = String(name || '').trim().slice(0, 120);
  if (!n) return { error: 'Firm name required.', status: 400 };
  const firmId = newId();
  const now = new Date().toISOString();
  const firmType = String(type || 'accountancy').slice(0, 40);
  getDb()
    .prepare(`INSERT INTO firms (id, name, type, created_at) VALUES (?, ?, ?, ?)`)
    .run(firmId, n, firmType, now);
  getDb()
    .prepare(
      `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, ?)`
    )
    .run(newId(), firmId, userId, 'practice_admin');
  return {
    ok: true,
    firm: { id: firmId, name: n, type: firmType, createdAt: now },
    role: 'practice_admin',
  };
}

/**
 * Soft operational delete: remove client if firm member. Does not cascade drafts.
 * @param {{ clientId: string, userId: string }} opts
 */
export function deleteClient({ clientId, userId }) {
  const client = getClientRow(clientId);
  if (!client) return { error: 'Client not found', status: 404 };
  const denied = assertPracticeAdmin(userId, client.firmId);
  if (denied) return denied;
  getDb().prepare(`DELETE FROM portal_invites WHERE client_id = ?`).run(clientId);
  getDb().prepare(`DELETE FROM workflow_events WHERE client_id = ?`).run(clientId);
  getDb().prepare(`DELETE FROM clients WHERE id = ?`).run(clientId);
  return { ok: true, client };
}

/**
 * Rename a firm the user belongs to.
 * @param {{ firmId: string, userId: string, name: string }} opts
 */
export function renameFirm({ firmId, userId, name }) {
  const denied = assertPracticeAdmin(userId, firmId);
  if (denied) return denied;
  const n = String(name || '').trim().slice(0, 120);
  if (!n) return { error: 'Firm name required.', status: 400 };
  getDb().prepare(`UPDATE firms SET name = ? WHERE id = ?`).run(n, firmId);
  const row = getDb().prepare(`SELECT * FROM firms WHERE id = ?`).get(firmId);
  return {
    ok: true,
    firm: row
      ? { id: row.id, name: row.name, type: row.type, createdAt: row.created_at }
      : null,
  };
}

export function updateClientStatus({
  clientId,
  userId,
  status,
  note,
}) {
  const client = getClientRow(clientId);
  if (!client) return { error: 'Client not found', status: 404 };
  const denied = assertClientMutator(userId, client.firmId);
  if (denied) return denied;
  const allowed = TRANSITIONS[client.status] || [];
  if (!allowed.includes(status)) {
    return {
      error: `Cannot move from ${client.statusLabel} to ${LABELS[status] || status}.`,
      status: 422,
    };
  }
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE clients SET workflow_status = ?, updated_at = ? WHERE id = ?`
    )
    .run(status, now, clientId);
  getDb()
    .prepare(
      `INSERT INTO workflow_events (id, firm_id, client_id, from_status, to_status, actor_user_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      newId(),
      client.firmId,
      clientId,
      client.status,
      status,
      userId,
      note || null,
      now
    );
  const updated = getClientRow(clientId);
  mirrorClientWrite(updated);
  return {
    client: updated,
    transitions: updated?.transitions || listAllowedTransitions(status),
  };
}
