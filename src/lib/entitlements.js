/**
 * Plan entitlements (billing stub). Plans as string constants — no enums.
 */

import { getDb } from './db.js';
import { newId } from './auth.js';

export const PLAN_FREE = 'free';
export const PLAN_PERSONAL = 'personal';
export const PLAN_PROFESSIONAL = 'professional';
export const PLAN_PRACTICE = 'practice';

const PLAN_FEATURES = {
  free: {
    label: 'Free trial',
    maxDraftsPerDay: 20,
    liveHmrc: false,
    workspace: false,
  },
  personal: {
    label: 'Personal',
    maxDraftsPerDay: 200,
    liveHmrc: true,
    workspace: false,
  },
  professional: {
    label: 'Professional',
    maxDraftsPerDay: 2000,
    liveHmrc: true,
    workspace: true,
  },
  practice: {
    label: 'Practice',
    maxDraftsPerDay: 20000,
    liveHmrc: true,
    workspace: true,
  },
};

/**
 * @param {string} userId
 */
export function getUserPlan(userId) {
  const row = getDb()
    .prepare(
      `SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId);
  const planId = row?.plan_id || PLAN_FREE;
  const features = PLAN_FEATURES[planId] || PLAN_FEATURES.free;
  return {
    planId,
    label: features.label,
    features,
    subscription: row || null,
  };
}

/**
 * @param {string} userId
 * @param {string} planId
 */
export function setUserPlan(userId, planId) {
  if (!PLAN_FEATURES[planId]) throw new Error('Unknown plan');
  const database = getDb();
  database
    .prepare(
      `UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'`
    )
    .run(userId);
  const id = newId();
  database
    .prepare(
      `INSERT INTO subscriptions (id, user_id, firm_id, plan_id, status, created_at)
       VALUES (?, ?, NULL, ?, 'active', ?)`
    )
    .run(id, userId, planId, new Date().toISOString());
  return getUserPlan(userId);
}

/**
 * Seed free plan for user if missing.
 * @param {string} userId
 */
export function ensureFreePlan(userId) {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM subscriptions WHERE user_id = ? AND status = 'active'`
    )
    .get(userId);
  if (!row) setUserPlan(userId, PLAN_FREE);
}

export function listPublicPlans() {
  return Object.entries(PLAN_FEATURES).map(([id, f]) => ({
    id,
    label: f.label,
    liveHmrc: f.liveHmrc,
    workspace: f.workspace,
    experimentalPricing: true,
  }));
}
