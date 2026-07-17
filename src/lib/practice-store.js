/**
 * In-memory demo store for bookkeeper/accountant practices and client portal.
 * String role constants only — no enums.
 */

/** @typedef {'bookkeeper' | 'accountant' | 'practice_admin' | 'client'} RoleId */

export const ROLE_BOOKKEEPER = 'bookkeeper';
export const ROLE_ACCOUNTANT = 'accountant';
export const ROLE_PRACTICE_ADMIN = 'practice_admin';
export const ROLE_CLIENT = 'client';

/** @type {Map<string, object>} */
const firms = new Map();
/** @type {Map<string, object>} */
const accountants = new Map();
/** @type {Map<string, object>} */
const clients = new Map();

export const WORKFLOW_STATUSES = {
  awaiting_file: 'Awaiting records',
  mapping_required: 'Mapping required',
  in_review: 'In review',
  client_query: 'Client query',
  ready_to_submit: 'Ready to submit',
  submitted: 'Submitted',
  correction_required: 'Correction required',
};

const WORKFLOW_TRANSITIONS = {
  awaiting_file: ['mapping_required', 'client_query'],
  mapping_required: ['in_review', 'client_query'],
  in_review: ['ready_to_submit', 'client_query'],
  client_query: ['awaiting_file', 'in_review'],
  ready_to_submit: ['submitted', 'in_review'],
  submitted: ['correction_required'],
  correction_required: ['in_review'],
};

let seeded = false;

export function ensureDemoData() {
  if (seeded) return;
  seeded = true;

  firms.set('firm-north', {
    id: 'firm-north',
    name: 'Northshore Accountancy LLP',
    type: 'multi_accountant_practice',
    plan: 'practice_license',
  });
  firms.set('firm-solo', {
    id: 'firm-solo',
    name: 'Patel Bookkeeping',
    type: 'sole_bookkeeper',
    plan: 'practitioner_license',
  });

  accountants.set('acc-1', {
    id: 'acc-1',
    name: 'Sam Okonkwo',
    role: ROLE_ACCOUNTANT,
    firmId: 'firm-north',
    email: 'sam@northshore.example',
  });
  accountants.set('acc-2', {
    id: 'acc-2',
    name: 'Priya Shah',
    role: ROLE_ACCOUNTANT,
    firmId: 'firm-north',
    email: 'priya@northshore.example',
  });
  accountants.set('acc-3', {
    id: 'acc-3',
    name: 'Lee Patel',
    role: ROLE_BOOKKEEPER,
    firmId: 'firm-solo',
    email: 'lee@patelbooks.example',
  });

  clients.set('cli-1', {
    id: 'cli-1',
    name: 'Jordan Mills Plumbing',
    type: 'self_employment',
    typeLabel: 'Self-employment',
    firmId: 'firm-north',
    accountantId: 'acc-1',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    status: 'ready_to_submit',
    statusLabel: 'Ready to submit',
    currentPeriod: '2026-27 Q1',
    dueDate: '2026-08-07',
    updatedAt: '2026-07-16T09:30:00.000Z',
    activity: [{ at: '2026-07-16T09:30:00.000Z', action: 'Marked ready to submit', by: 'Sam Okonkwo' }],
    sources: ['self_employment'],
    sourceLabels: ['Self-employment'],
    contactEmail: 'jordan@millsplumbing.example',
  });
  clients.set('cli-2', {
    id: 'cli-2',
    name: 'Aisha Khan Properties',
    type: 'uk_property',
    typeLabel: 'UK & foreign property',
    firmId: 'firm-north',
    accountantId: 'acc-2',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    status: 'awaiting_file',
    statusLabel: 'Awaiting period file',
    currentPeriod: '2026-27 Q1',
    dueDate: '2026-08-07',
    updatedAt: '2026-07-15T14:00:00.000Z',
    activity: [{ at: '2026-07-15T14:00:00.000Z', action: 'Records requested from client', by: 'Priya Shah' }],
    sources: ['uk_property', 'foreign_property'],
    sourceLabels: ['UK property', 'Foreign property'],
    contactEmail: 'aisha@khanproperties.example',
  });
  clients.set('cli-3', {
    id: 'cli-3',
    name: 'River Hair Studio',
    type: 'self_employment',
    typeLabel: 'Self-employment',
    firmId: 'firm-solo',
    accountantId: 'acc-3',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    status: 'submitted',
    statusLabel: 'Submitted',
    currentPeriod: '2026-27 Q1',
    dueDate: '2026-08-07',
    updatedAt: '2026-07-14T11:20:00.000Z',
    activity: [{ at: '2026-07-14T11:20:00.000Z', action: 'Quarterly update submitted', by: 'Lee Patel' }],
    sources: ['self_employment'],
    sourceLabels: ['Self-employment'],
    contactEmail: 'hello@riverhair.example',
  });
  clients.set('cli-4', {
    id: 'cli-4',
    name: 'Greenfield Lettings',
    type: 'mixed',
    typeLabel: 'Trade & UK property',
    firmId: 'firm-north',
    accountantId: 'acc-1',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    status: 'in_review',
    statusLabel: 'In review',
    currentPeriod: '2026-27 Q1',
    dueDate: '2026-08-07',
    updatedAt: '2026-07-17T08:45:00.000Z',
    activity: [{ at: '2026-07-17T08:45:00.000Z', action: 'Spreadsheet mapping reviewed', by: 'Sam Okonkwo' }],
    sources: ['self_employment', 'uk_property'],
    sourceLabels: ['Self-employment', 'UK property'],
    contactEmail: 'ops@greenfieldlettings.example',
  });
}

export function listFirms() {
  ensureDemoData();
  return [...firms.values()];
}

/**
 * @param {string | null} firmId
 */
export function listAccountants(firmId) {
  ensureDemoData();
  let list = [...accountants.values()];
  if (firmId) list = list.filter((a) => a.firmId === firmId);
  return list;
}

/**
 * @param {{ firmId?: string | null, accountantId?: string | null }} filter
 */
export function listClientsForFirm(filter = {}) {
  ensureDemoData();
  let list = [...clients.values()];
  if (filter.firmId) list = list.filter((c) => c.firmId === filter.firmId);
  if (filter.accountantId)
    list = list.filter((c) => c.accountantId === filter.accountantId);
  return list;
}

/**
 * @param {string} clientId
 */
export function getClient(clientId) {
  ensureDemoData();
  return clients.get(clientId) || null;
}

export function listWorkflowStatuses() {
  return Object.entries(WORKFLOW_STATUSES).map(([id, label]) => ({ id, label }));
}

export function allowedClientTransitions(clientId) {
  const client = getClient(clientId);
  if (!client) return null;
  return (WORKFLOW_TRANSITIONS[client.status] || []).map((id) => ({
    id,
    label: WORKFLOW_STATUSES[id],
  }));
}

/** Update one client's operational status or owner. */
export function updateClientWorkflow(clientId, changes = {}) {
  const client = getClient(clientId);
  if (!client) return { error: 'Client not found', status: 404 };
  const nextStatus = changes.status;
  if (nextStatus) {
    const allowed = WORKFLOW_TRANSITIONS[client.status] || [];
    if (!allowed.includes(nextStatus)) {
      return { error: `Cannot move from ${WORKFLOW_STATUSES[client.status]} to ${WORKFLOW_STATUSES[nextStatus] || nextStatus}.`, status: 422 };
    }
    client.status = nextStatus;
    client.statusLabel = WORKFLOW_STATUSES[nextStatus];
  }
  if (changes.accountantId) {
    const accountant = accountants.get(changes.accountantId);
    if (!accountant || accountant.firmId !== client.firmId) {
      return { error: 'The selected practitioner does not belong to this client firm.', status: 422 };
    }
    client.accountantId = accountant.id;
  }
  const at = new Date().toISOString();
  const actor = changes.actor || 'Practice user';
  const action = changes.note || (nextStatus ? `Moved to ${WORKFLOW_STATUSES[nextStatus]}` : 'Client owner updated');
  client.updatedAt = at;
  client.activity = [{ at, action, by: actor }, ...(client.activity || [])].slice(0, 20);
  return { client, transitions: allowedClientTransitions(clientId) };
}
