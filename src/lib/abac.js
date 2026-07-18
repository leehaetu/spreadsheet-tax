/**
 * Attribute-Based Access Control — resource + environment attributes.
 * Complements RBAC: even with the right role, attributes may deny.
 */

import { roleHasPermission, PERMISSIONS } from './rbac.js';
import { getMembership } from './access-control.js';

/**
 * @typedef {object} Actor
 * @property {string} id
 * @property {string} [email]
 * @property {string} [planId]
 * @property {boolean} [mfaVerified]
 */

/**
 * @typedef {object} Resource
 * @property {'draft'|'client'|'firm'|'submission'|'job'} type
 * @property {string} [id]
 * @property {string|null} [userId] owner
 * @property {string|null} [firmId]
 * @property {string|null} [clientId]
 * @property {string|null} [assigneeUserId]
 * @property {boolean} [approved]
 * @property {string|null} [approverUserId]
 * @property {string|null} [preparerUserId]
 */

/**
 * @typedef {object} AbacContext
 * @property {string} action - permission string
 * @property {boolean} [dualControlRequired]
 * @property {boolean} [liveHmrc]
 * @property {string} [ip]
 * @property {string} [hmrcMode]
 */

/**
 * Evaluate ABAC decision.
 * @param {Actor|null} actor
 * @param {Resource} resource
 * @param {AbacContext} ctx
 * @returns {{ allow: boolean, reason: string, code?: string }}
 */
export function evaluateAbac(actor, resource, ctx) {
  if (!actor?.id) {
    return { allow: false, reason: 'Sign in required.', code: 'UNAUTHENTICATED' };
  }
  if (!ctx?.action) {
    return { allow: false, reason: 'Action required.', code: 'NO_ACTION' };
  }

  // Personal resources: owner only (no firm)
  if (resource.type === 'draft' && !resource.firmId) {
    if (resource.userId && resource.userId !== actor.id) {
      return { allow: false, reason: 'Not your draft.', code: 'NOT_OWNER' };
    }
    // Owner path still needs permission semantics for submit
    if (
      ctx.action === PERMISSIONS.DRAFT_SUBMIT ||
      ctx.action === PERMISSIONS.DRAFT_WRITE ||
      ctx.action === PERMISSIONS.DRAFT_READ
    ) {
      return { allow: true, reason: 'owner' };
    }
  }

  // Firm-scoped: membership + RBAC permission
  if (resource.firmId) {
    const membership = getMembership(actor.id, resource.firmId);
    if (!membership) {
      return { allow: false, reason: 'Not a member of this firm.', code: 'NO_MEMBERSHIP' };
    }
    if (!roleHasPermission(membership.role, ctx.action)) {
      return {
        allow: false,
        reason: 'Role lacks permission for this action.',
        code: 'RBAC_DENY',
      };
    }

    // Dual control: preparer cannot be sole approver/submitter when required
    if (
      ctx.dualControlRequired &&
      (ctx.action === PERMISSIONS.DRAFT_SUBMIT || ctx.action === 'draft:approve')
    ) {
      const preparer = resource.preparerUserId || resource.userId;
      if (preparer && preparer === actor.id) {
        return {
          allow: false,
          reason: 'Dual control required: preparer cannot self-approve/submit.',
          code: 'DUAL_CONTROL',
        };
      }
    }

    // Assignee attribute: optional tighter scope for bookkeepers on client write
    if (
      membership.role === 'bookkeeper' &&
      resource.type === 'client' &&
      resource.assigneeUserId &&
      resource.assigneeUserId !== actor.id &&
      (ctx.action === PERMISSIONS.CLIENT_WRITE ||
        ctx.action === PERMISSIONS.CLIENT_WORKFLOW)
    ) {
      // Soft ABAC: allow read, deny write on unassigned clients when ASSIGNee_ENFORCE=1
      if (process.env.ABAC_ASSIGNEE_ENFORCE === '1') {
        return {
          allow: false,
          reason: 'Client is assigned to another team member.',
          code: 'NOT_ASSIGNEE',
        };
      }
    }

    return { allow: true, reason: `role:${membership.role}` };
  }

  // Default personal product actions
  if (roleHasPermission('individual', ctx.action) || actor.id) {
    if (
      [
        PERMISSIONS.DRAFT_READ,
        PERMISSIONS.DRAFT_WRITE,
        PERMISSIONS.DRAFT_SUBMIT,
      ].includes(ctx.action)
    ) {
      return { allow: true, reason: 'individual' };
    }
  }

  return { allow: false, reason: 'No matching ABAC policy.', code: 'NO_POLICY' };
}

/**
 * Convenience deny object for Express.
 * @param {ReturnType<typeof evaluateAbac>} decision
 */
export function abacToHttp(decision) {
  if (decision.allow) return null;
  const status =
    decision.code === 'UNAUTHENTICATED'
      ? 401
      : decision.code === 'NO_MEMBERSHIP' || decision.code === 'RBAC_DENY' || decision.code === 'DUAL_CONTROL' || decision.code === 'NOT_OWNER' || decision.code === 'NOT_ASSIGNEE'
        ? 403
        : 403;
  return { error: decision.reason, status, code: decision.code || 'FORBIDDEN' };
}
