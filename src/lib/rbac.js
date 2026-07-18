/**
 * Role-Based Access Control — firm and product permissions.
 * Roles are string constants only (no language enums).
 */

import {
  ROLE_BOOKKEEPER,
  ROLE_ACCOUNTANT,
  ROLE_PRACTICE_ADMIN,
  ROLE_INDIVIDUAL,
} from './auth.js';

/** @typedef {string} Permission */

export const PERMISSIONS = {
  FIRM_READ: 'firm:read',
  FIRM_RENAME: 'firm:rename',
  FIRM_INVITE: 'firm:invite',
  FIRM_DELETE_CLIENT: 'firm:delete_client',
  CLIENT_READ: 'client:read',
  CLIENT_WRITE: 'client:write',
  CLIENT_WORKFLOW: 'client:workflow',
  DRAFT_READ: 'draft:read',
  DRAFT_WRITE: 'draft:write',
  DRAFT_SUBMIT: 'draft:submit',
  JOB_ENQUEUE: 'job:enqueue',
  AUDIT_READ: 'audit:read',
  BILLING_MANAGE: 'billing:manage',
  MFA_REQUIRE_OTHERS: 'mfa:require_others',
  HMRC_CONNECT_AGENT: 'hmrc:connect_agent',
};

/** Role → permissions */
const ROLE_MATRIX = {
  [ROLE_PRACTICE_ADMIN]: new Set([
    PERMISSIONS.FIRM_READ,
    PERMISSIONS.FIRM_RENAME,
    PERMISSIONS.FIRM_INVITE,
    PERMISSIONS.FIRM_DELETE_CLIENT,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.CLIENT_WORKFLOW,
    PERMISSIONS.DRAFT_READ,
    PERMISSIONS.DRAFT_WRITE,
    PERMISSIONS.DRAFT_SUBMIT,
    PERMISSIONS.JOB_ENQUEUE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.BILLING_MANAGE,
    PERMISSIONS.MFA_REQUIRE_OTHERS,
    PERMISSIONS.HMRC_CONNECT_AGENT,
  ]),
  [ROLE_ACCOUNTANT]: new Set([
    PERMISSIONS.FIRM_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.CLIENT_WORKFLOW,
    PERMISSIONS.DRAFT_READ,
    PERMISSIONS.DRAFT_WRITE,
    PERMISSIONS.DRAFT_SUBMIT,
    PERMISSIONS.JOB_ENQUEUE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.HMRC_CONNECT_AGENT,
  ]),
  [ROLE_BOOKKEEPER]: new Set([
    PERMISSIONS.FIRM_READ,
    PERMISSIONS.CLIENT_READ,
    PERMISSIONS.CLIENT_WRITE,
    PERMISSIONS.CLIENT_WORKFLOW,
    PERMISSIONS.DRAFT_READ,
    PERMISSIONS.DRAFT_WRITE,
    // bookkeeper may prepare but not invite/delete/admin jobs
  ]),
  [ROLE_INDIVIDUAL]: new Set([
    PERMISSIONS.DRAFT_READ,
    PERMISSIONS.DRAFT_WRITE,
    PERMISSIONS.DRAFT_SUBMIT,
  ]),
};

/**
 * @param {string|null|undefined} role
 * @param {string} permission
 */
export function roleHasPermission(role, permission) {
  if (!role || !permission) return false;
  const set = ROLE_MATRIX[role];
  return Boolean(set && set.has(permission));
}

/**
 * @param {string|null|undefined} role
 * @returns {string[]}
 */
export function listPermissionsForRole(role) {
  const set = ROLE_MATRIX[role];
  return set ? [...set] : [];
}

/**
 * @param {string} permission
 * @returns {string[]}
 */
export function rolesWithPermission(permission) {
  return Object.entries(ROLE_MATRIX)
    .filter(([, set]) => set.has(permission))
    .map(([role]) => role);
}

export { ROLE_MATRIX };
