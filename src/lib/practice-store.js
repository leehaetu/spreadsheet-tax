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
    firmId: 'firm-north',
    accountantId: 'acc-1',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    sources: ['self_employment'],
  });
  clients.set('cli-2', {
    id: 'cli-2',
    name: 'Aisha Khan Properties',
    type: 'uk_property',
    firmId: 'firm-north',
    accountantId: 'acc-2',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    sources: ['uk_property', 'foreign_property'],
  });
  clients.set('cli-3', {
    id: 'cli-3',
    name: 'River Hair Studio',
    type: 'self_employment',
    firmId: 'firm-solo',
    accountantId: 'acc-3',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    sources: ['self_employment'],
  });
  clients.set('cli-4', {
    id: 'cli-4',
    name: 'Greenfield Lettings',
    type: 'mixed',
    firmId: 'firm-north',
    accountantId: 'acc-1',
    portalAccess: true,
    lastPeriod: '2024-25 Q1',
    sources: ['self_employment', 'uk_property'],
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
