/**
 * Password hashing + session cookies. String roles only — no enums.
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';

export const ROLE_INDIVIDUAL = 'individual';
export const ROLE_BOOKKEEPER = 'bookkeeper';
export const ROLE_ACCOUNTANT = 'accountant';
export const ROLE_PRACTICE_ADMIN = 'practice_admin';

const SESSION_COOKIE = 'st_session';
const SESSION_DAYS = 7;

export function newId() {
  return crypto.randomUUID();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

export function createUser({ email, password, name }) {
  const database = getDb();
  const id = newId();
  const now = new Date().toISOString();
  const normalized = String(email).trim().toLowerCase();
  database
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, normalized, hashPassword(password), name || normalized, now);
  return { id, email: normalized, name: name || normalized, createdAt: now };
}

export function findUserByEmail(email) {
  const database = getDb();
  return database
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .get(String(email).trim().toLowerCase());
}

export function findUserById(id) {
  return getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

export function createSession(userId) {
  const database = getDb();
  const id = newId();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 864e5);
  database
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`
    )
    .run(id, userId, expires.toISOString(), now.toISOString());
  return { id, expiresAt: expires };
}

export function getSessionUser(sessionId) {
  if (!sessionId) return null;
  const database = getDb();
  const row = database
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    database.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    sessionId: row.session_id,
  };
}

export function destroySession(sessionId) {
  if (!sessionId) return;
  getDb().prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

/**
 * @param {string} userId
 * @param {string} [exceptSessionId]
 */
export function destroyAllSessionsForUser(userId, exceptSessionId = null) {
  if (exceptSessionId) {
    getDb()
      .prepare(`DELETE FROM sessions WHERE user_id = ? AND id != ?`)
      .run(userId, exceptSessionId);
  } else {
    getDb().prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  }
}

/**
 * @param {string} userId
 * @param {string} newPassword
 */
export function updatePassword(userId, newPassword) {
  getDb()
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .run(hashPassword(newPassword), userId);
}

/**
 * Create a one-time password reset token (1 hour).
 * @param {string} email
 */
export function createPasswordResetToken(email) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 3600e3);
  getDb()
    .prepare(
      `INSERT INTO password_resets (token, user_id, created_at, expires_at, used_at)
       VALUES (?, ?, ?, ?, NULL)`
    )
    .run(token, user.id, now.toISOString(), expires.toISOString());
  return { token, userId: user.id, email: user.email, expiresAt: expires };
}

/**
 * @param {string} token
 * @param {string} newPassword
 */
export function consumePasswordResetToken(token, newPassword) {
  const row = getDb()
    .prepare(`SELECT * FROM password_resets WHERE token = ?`)
    .get(token);
  if (!row || row.used_at) return { error: 'Invalid or used reset link.' };
  if (new Date(row.expires_at) < new Date()) {
    return { error: 'Reset link has expired.' };
  }
  updatePassword(row.user_id, newPassword);
  getDb()
    .prepare(`UPDATE password_resets SET used_at = ? WHERE token = ?`)
    .run(new Date().toISOString(), token);
  destroyAllSessionsForUser(row.user_id);
  return { ok: true, userId: row.user_id };
}

export function parseCookies(req) {
  const header = req.headers?.cookie || '';
  /** @type {Record<string, string>} */
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookieHeader(sessionId, expiresAt) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearSessionCookieHeader() {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function getSessionIdFromRequest(req) {
  return parseCookies(req)[SESSION_COOKIE] || null;
}

export function requireUser(req, res) {
  const user = getSessionUser(getSessionIdFromRequest(req));
  if (!user) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }
  return user;
}

export function listMemberships(userId) {
  return getDb()
    .prepare(
      `SELECT m.*, f.name AS firm_name, f.type AS firm_type
       FROM firm_memberships m
       JOIN firms f ON f.id = m.firm_id
       WHERE m.user_id = ?`
    )
    .all(userId);
}

export function userCanAccessFirm(userId, firmId) {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM firm_memberships WHERE user_id = ? AND firm_id = ?`
    )
    .get(userId, firmId);
  return Boolean(row);
}

export function ensureDemoAuthSeed() {
  const database = getDb();
  let existing = findUserByEmail('demo@spreadsheet-tax.example');
  if (existing) {
    // Ensure firm membership exists for demo
    const m = database
      .prepare(`SELECT 1 FROM firm_memberships WHERE user_id = ? LIMIT 1`)
      .get(existing.id);
    if (m) return existing;
  }
  const user =
    existing ||
    createUser({
      email: 'demo@spreadsheet-tax.example',
      password: 'DemoPass123!',
      name: 'Demo User',
    });
  const firmId = newId();
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO firms (id, name, type, created_at) VALUES (?, ?, ?, ?)`
    )
    .run(firmId, 'Demo Practice LLP', 'multi_accountant', now);
  database
    .prepare(
      `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, ?)`
    )
    .run(newId(), firmId, user.id, ROLE_PRACTICE_ADMIN);
  for (const [name, status] of [
    ['Jordan Mills Plumbing', 'ready_to_submit'],
    ['Aisha Khan Properties', 'awaiting_records'],
  ]) {
    database
      .prepare(
        `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(newId(), firmId, name, status, user.id, '2025-07-05', now, now);
  }
  return user;
}

export { SESSION_COOKIE };
