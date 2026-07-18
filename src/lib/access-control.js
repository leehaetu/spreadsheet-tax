/**
 * Central authorisation for drafts, firms, clients, jobs.
 * Membership alone is not enough for admin actions — roles are enforced.
 * RBAC matrix: `rbac.js`. ABAC attributes: `abac.js`.
 */

import { getDb } from './db.js';
import {
  ROLE_PRACTICE_ADMIN,
  ROLE_ACCOUNTANT,
  ROLE_BOOKKEEPER,
  userCanAccessFirm,
} from './auth.js';
import { getDraft } from './drafts.js';
import { rolesWithPermission, PERMISSIONS } from './rbac.js';
import { evaluateAbac, abacToHttp } from './abac.js';

/** Roles that may invite users and rename/delete firm resources. */
export const ADMIN_ROLES = new Set(rolesWithPermission(PERMISSIONS.FIRM_INVITE));

/** Roles that may mutate clients (status, import, delete) within a firm. */
export const CLIENT_MUTATOR_ROLES = new Set(
  rolesWithPermission(PERMISSIONS.CLIENT_WRITE)
);

/** Roles that may trigger firm-scoped operational jobs (reminders). */
export const JOB_OPERATOR_ROLES = new Set(
  rolesWithPermission(PERMISSIONS.JOB_ENQUEUE)
);

export { PERMISSIONS };

/**
 * @param {string} userId
 * @param {string} firmId
 * @returns {{ role: string } | null}
 */
export function getMembership(userId, firmId) {
  if (!userId || !firmId) return null;
  const row = getDb()
    .prepare(
      `SELECT role FROM firm_memberships WHERE user_id = ? AND firm_id = ?`
    )
    .get(userId, firmId);
  return row ? { role: row.role } : null;
}

/**
 * @param {string} userId
 * @param {string} firmId
 * @param {Set<string>|string[]} allowedRoles
 */
export function userHasFirmRole(userId, firmId, allowedRoles) {
  const m = getMembership(userId, firmId);
  if (!m) return false;
  const set =
    allowedRoles instanceof Set ? allowedRoles : new Set(allowedRoles);
  return set.has(m.role);
}

/**
 * Assert firm membership (+ optional role). Returns error object or null if ok.
 * @param {string} userId
 * @param {string} firmId
 * @param {{ roles?: Set<string>|string[] }} [opts]
 * @returns {{ error: string, status: number } | null}
 */
export function assertFirmAccess(userId, firmId, opts = {}) {
  if (!userId) return { error: 'Sign in required.', status: 401 };
  if (!firmId) return { error: 'Firm required.', status: 400 };
  if (!userCanAccessFirm(userId, firmId)) {
    return { error: 'Not allowed for this firm.', status: 403 };
  }
  if (opts.roles) {
    if (!userHasFirmRole(userId, firmId, opts.roles)) {
      return {
        error: 'Insufficient role for this action.',
        status: 403,
      };
    }
  }
  return null;
}

/**
 * Can the actor use this draft for submit/read?
 * - Anonymous drafts (userId null): only same-session anonymous submit without
 *   another user's token is allowed for *preview*; if a user is signed in they
 *   may only use drafts they own or firm drafts they can access.
 * - Owned draft: userId must match OR firm membership on draft.firmId.
 *
 * @param {object|null} draft
 * @param {{ id: string }|null} user
 * @param {{ forSubmit?: boolean }} [opts]
 * @returns {{ error: string, status: number } | null}
 */
export function assertDraftAccess(draft, user, opts = {}) {
  if (!draft) return { error: 'Draft not found.', status: 404 };

  // Firm-scoped draft: require firm membership
  if (draft.firmId) {
    if (!user) return { error: 'Sign in required for this draft.', status: 401 };
    const denied = assertFirmAccess(user.id, draft.firmId, {
      roles: opts.forSubmit ? CLIENT_MUTATOR_ROLES : undefined,
    });
    if (denied) return denied;
    return null;
  }

  // User-owned draft
  if (draft.userId) {
    if (!user) return { error: 'Sign in required for this draft.', status: 401 };
    if (draft.userId !== user.id) {
      return { error: 'Not allowed to use this draft.', status: 403 };
    }
    return null;
  }

  // Anonymous draft (no user_id): must not be world-readable/writable by UUID guess.
  // Require sign-in; caller may then bind/use the draft under their session.
  if (!draft.userId) {
    if (!user) {
      return { error: 'Sign in required for this draft.', status: 401 };
    }
    return null;
  }

  return null;
}

/**
 * Load draft and assert access.
 * @param {string} draftId
 * @param {{ id: string }|null} user
 * @param {{ forSubmit?: boolean }} [opts]
 */
export function loadDraftForUser(draftId, user, opts = {}) {
  const draft = getDraft(String(draftId));
  const denied = assertDraftAccess(draft, user, opts);
  if (denied) return { error: denied.error, status: denied.status, draft: null };
  return { draft, error: null, status: 200 };
}

/**
 * Practice admin or accountant for firm invites / rename / delete firm resources.
 */
export function assertPracticeAdmin(userId, firmId) {
  return assertFirmAccess(userId, firmId, { roles: ADMIN_ROLES });
}

/**
 * Client mutators within firm.
 */
export function assertClientMutator(userId, firmId) {
  return assertFirmAccess(userId, firmId, { roles: CLIENT_MUTATOR_ROLES });
}

/**
 * Job operators (reminders) for a firm.
 */
export function assertJobOperator(userId, firmId) {
  return assertFirmAccess(userId, firmId, { roles: JOB_OPERATOR_ROLES });
}

/**
 * Unified authorize: RBAC + ABAC.
 * @param {{ id: string }|null} user
 * @param {import('./abac.js').Resource} resource
 * @param {import('./abac.js').AbacContext} ctx
 * @returns {{ error: string, status: number, code?: string } | null}
 */
export function authorize(user, resource, ctx) {
  const decision = evaluateAbac(user, resource, ctx);
  return abacToHttp(decision);
}

/**
 * Firm action helper using permission string.
 * @param {string} userId
 * @param {string} firmId
 * @param {string} permission
 */
export function assertFirmPermission(userId, firmId, permission) {
  return authorize(
    { id: userId },
    { type: 'firm', firmId, id: firmId },
    { action: permission }
  );
}
