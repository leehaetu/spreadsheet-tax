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
