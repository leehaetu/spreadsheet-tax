/**
 * Login failure lockout / throttle (account + IP).
 * Uses login_failures table in SQLite (see db.js).
 */

import { getDb } from './db.js';

const MAX_FAILURES = Number(process.env.LOGIN_LOCKOUT_MAX || 8);
const WINDOW_MS = Number(process.env.LOGIN_LOCKOUT_WINDOW_MS || 15 * 60e3);
const LOCK_MS = Number(process.env.LOGIN_LOCKOUT_MS || 15 * 60e3);

/**
 * @param {string} key
 */
function row(key) {
  return getDb().prepare(`SELECT * FROM login_failures WHERE key = ?`).get(key);
}

/**
 * @param {string} key email or ip:…
 */
export function isLoginLocked(key) {
  const r = row(String(key).toLowerCase());
  if (!r) return { locked: false, remainingMs: 0, count: 0 };
  const last = new Date(r.last_at).getTime();
  const first = new Date(r.first_at).getTime();
  const now = Date.now();
  // Reset window if quiet long enough
  if (now - last > WINDOW_MS) {
    getDb().prepare(`DELETE FROM login_failures WHERE key = ?`).run(r.key);
    return { locked: false, remainingMs: 0, count: 0 };
  }
  if (r.count >= MAX_FAILURES) {
    const unlockAt = last + LOCK_MS;
    if (now < unlockAt) {
      return {
        locked: true,
        remainingMs: unlockAt - now,
        count: r.count,
      };
    }
    getDb().prepare(`DELETE FROM login_failures WHERE key = ?`).run(r.key);
    return { locked: false, remainingMs: 0, count: 0 };
  }
  return { locked: false, remainingMs: 0, count: r.count, firstAt: first };
}

/**
 * @param {string} key
 */
export function recordLoginFailure(key) {
  const k = String(key).toLowerCase();
  const database = getDb();
  const now = new Date().toISOString();
  const existing = row(k);
  if (!existing) {
    database
      .prepare(
        `INSERT INTO login_failures (key, count, first_at, last_at) VALUES (?, 1, ?, ?)`
      )
      .run(k, now, now);
    return { count: 1 };
  }
  // Window expired → reset
  if (Date.now() - new Date(existing.last_at).getTime() > WINDOW_MS) {
    database
      .prepare(
        `UPDATE login_failures SET count = 1, first_at = ?, last_at = ? WHERE key = ?`
      )
      .run(now, now, k);
    return { count: 1 };
  }
  database
    .prepare(`UPDATE login_failures SET count = count + 1, last_at = ? WHERE key = ?`)
    .run(now, k);
  return { count: existing.count + 1 };
}

/**
 * @param {string} key
 */
export function clearLoginFailures(key) {
  getDb()
    .prepare(`DELETE FROM login_failures WHERE key = ?`)
    .run(String(key).toLowerCase());
}

export function loginLockoutConfig() {
  return {
    maxFailures: MAX_FAILURES,
    windowMs: WINDOW_MS,
    lockMs: LOCK_MS,
  };
}
