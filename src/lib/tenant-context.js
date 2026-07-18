/**
 * Tenant context for the current request — memberships, active firm, RLS session vars.
 */

import { getDb } from './db.js';
import { isPostgresMode } from './platform-config.js';
import { pgQuery } from './pg-pool.js';

/**
 * @param {string} userId
 * @returns {{ firmId: string, role: string }[]}
 */
export function listUserMemberships(userId) {
  if (!userId) return [];
  return getDb()
    .prepare(
      `SELECT firm_id AS firmId, role FROM firm_memberships WHERE user_id = ?`
    )
    .all(userId)
    .map((r) => ({ firmId: r.firmId, role: r.role }));
}

/**
 * @param {string} userId
 * @returns {Set<string>}
 */
export function firmIdSetForUser(userId) {
  return new Set(listUserMemberships(userId).map((m) => m.firmId));
}

/**
 * Reject when client supplies a firmId outside memberships.
 * @param {string} userId
 * @param {string|null|undefined} firmId
 */
export function assertClientFirmId(userId, firmId) {
  if (!firmId) return { ok: true };
  if (!firmIdSetForUser(userId).has(firmId)) {
    return {
      ok: false,
      error: 'firmId is not in your memberships.',
      status: 403,
      code: 'TENANT_FIRM_MISMATCH',
    };
  }
  return { ok: true };
}

/**
 * Apply Postgres RLS session variables for this connection.
 * Policies use current_setting('app.user_id', true) and app.firm_ids (comma-separated).
 * @param {string} userId
 * @param {string[]} [firmIds]
 */
export async function applyPostgresRlsContext(userId, firmIds) {
  if (!isPostgresMode()) return { applied: false };
  const ids = firmIds || [...firmIdSetForUser(userId)];
  const firmCsv = ids.join(',');
  // set_config(…, true) = local to transaction/session depending on driver usage
  await pgQuery(`SELECT set_config('app.user_id', ?, true)`, [userId || '']);
  await pgQuery(`SELECT set_config('app.firm_ids', ?, true)`, [firmCsv]);
  return { applied: true, firmIds: ids };
}

/**
 * Clear RLS session vars (after request if using pooled connection carefully).
 * Note: with PgBouncer transaction pooling, always set on each checkout.
 */
export async function clearPostgresRlsContext() {
  if (!isPostgresMode()) return;
  await pgQuery(`SELECT set_config('app.user_id', '', true)`);
  await pgQuery(`SELECT set_config('app.firm_ids', '', true)`);
}

/**
 * Safe client list — always firm-scoped; never accept unscoped queries.
 * @param {string} userId
 * @param {string} firmId
 * @param {{ limit?: number, offset?: number }} [opts]
 */
export function listClientsForTenant(userId, firmId, opts = {}) {
  const check = assertClientFirmId(userId, firmId);
  if (!check.ok) return { error: check.error, status: check.status, clients: [] };
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const clients = getDb()
    .prepare(
      `SELECT id, firm_id AS firmId, display_name AS displayName, workflow_status AS workflowStatus,
              assignee_user_id AS assigneeUserId, due_date AS dueDate, portal_enabled AS portalEnabled,
              created_at AS createdAt, updated_at AS updatedAt
       FROM clients WHERE firm_id = ?
       ORDER BY display_name LIMIT ? OFFSET ?`
    )
    .all(firmId, limit, offset);
  return { clients, limit, offset };
}
