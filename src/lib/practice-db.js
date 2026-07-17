/**
 * Persistent practice clients (tenant-scoped). Complements demo practice-store.
 */

import { getDb } from './db.js';
import { newId, userCanAccessFirm } from './auth.js';

const TRANSITIONS = {
  awaiting_records: ['records_received', 'mapping_required'],
  records_received: ['mapping_required', 'needs_review'],
  mapping_required: ['needs_review', 'client_query'],
  needs_review: ['ready_for_approval', 'client_query', 'ready_to_submit'],
  client_query: ['records_received', 'needs_review'],
  ready_for_approval: ['ready_to_submit', 'needs_review'],
  ready_to_submit: ['submitted', 'needs_review'],
  submitted: ['rejected', 'correction_required'],
  rejected: ['correction_required', 'needs_review'],
  correction_required: ['mapping_required', 'needs_review'],
};

const LABELS = {
  awaiting_records: 'Awaiting records',
  records_received: 'Records received',
  mapping_required: 'Mapping required',
  needs_review: 'Needs review',
  client_query: 'Client query',
  ready_for_approval: 'Ready for approval',
  ready_to_submit: 'Ready to submit',
  submitted: 'Submitted',
  rejected: 'Rejected',
  correction_required: 'Correction required',
};

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

export function getClientRow(clientId) {
  const row = getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId);
  return row ? mapClient(row) : null;
}

function mapClient(row) {
  return {
    id: row.id,
    firmId: row.firm_id,
    name: row.display_name,
    status: row.workflow_status,
    statusLabel: LABELS[row.workflow_status] || row.workflow_status,
    assigneeUserId: row.assignee_user_id,
    dueDate: row.due_date,
    portalAccess: Boolean(row.portal_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function allowedTransitions(status) {
  return (TRANSITIONS[status] || []).map((id) => ({
    id,
    label: LABELS[id] || id,
  }));
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
  return { client: getClientRow(clientId) };
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
  if (!userCanAccessFirm(invitedBy, firmId)) {
    return { error: 'Not allowed for this firm.', status: 403 };
  }
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

export function exportClientsCsv(firmId) {
  const clients = listClients(firmId);
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

export function updateClientStatus({
  clientId,
  userId,
  status,
  note,
}) {
  const client = getClientRow(clientId);
  if (!client) return { error: 'Client not found', status: 404 };
  if (!userCanAccessFirm(userId, client.firmId)) {
    return { error: 'Not allowed for this firm.', status: 403 };
  }
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
  return { client: getClientRow(clientId), transitions: allowedTransitions(status) };
}
