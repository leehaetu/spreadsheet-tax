/**
 * CSRF protection for authenticated state-changing API requests.
 * Double-submit: opaque token stored server-side + required in X-CSRF-Token header.
 *
 * Enforce when CSRF_ENFORCE=1 or NODE_ENV=production (unless CSRF_ENFORCE=0).
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import { getSessionIdFromRequest, getSessionUser } from './auth.js';

const HEADER = 'x-csrf-token';
const COOKIE = 'st_csrf';
const TTL_MS = 24 * 3600e3;

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function csrfEnforced(env = process.env) {
  if (env.CSRF_ENFORCE === '0') return false;
  if (env.CSRF_ENFORCE === '1') return true;
  return env.NODE_ENV === 'production';
}

/**
 * @param {string|null|undefined} userId
 */
export function issueCsrfToken(userId = null) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const exp = new Date(now.getTime() + TTL_MS);
  getDb()
    .prepare(
      `INSERT INTO csrf_tokens (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(token, userId || null, now.toISOString(), exp.toISOString());
  return { token, expiresAt: exp };
}

/**
 * @param {string|null|undefined} token
 * @param {string|null|undefined} userId
 */
export function verifyCsrfToken(token, userId = null) {
  if (!token || typeof token !== 'string' || token.length < 16) return false;
  const row = getDb()
    .prepare(`SELECT * FROM csrf_tokens WHERE token = ?`)
    .get(token);
  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) {
    getDb().prepare(`DELETE FROM csrf_tokens WHERE token = ?`).run(token);
    return false;
  }
  if (row.user_id && userId && row.user_id !== userId) return false;
  return true;
}

/**
 * @param {string} token
 * @param {Date} expiresAt
 */
export function csrfCookieHeader(token, expiresAt) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

/**
 * Paths that never require CSRF (auth bootstrap + token issue + analytics).
 * @param {string} path
 */
export function csrfExemptPath(path) {
  const p = path.split('?')[0];
  if (p === '/api/csrf' || p === '/api/csrf-token') return true;
  if (p === '/api/auth/login' || p === '/api/auth/register') return true;
  if (p === '/api/auth/logout') return true;
  if (p === '/api/auth/forgot-password' || p === '/api/auth/reset-password') return true;
  if (p === '/api/analytics/cta') return true;
  if (p === '/api/health' || p === '/health') return true;
  return false;
}

/**
 * Express middleware — after JSON body parser.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function csrfProtectionMiddleware(req, res, next) {
  if (!csrfEnforced()) return next();
  const method = String(req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
  const path = req.path || req.url || '';
  if (!String(path).startsWith('/api/')) return next();
  if (csrfExemptPath(path)) return next();

  const user = getSessionUser(getSessionIdFromRequest(req));
  // Only enforce when the caller has a session (authenticated mutations)
  if (!user) return next();

  const headerTok = req.headers[HEADER] || req.headers['x-xsrf-token'];
  const cookies = String(req.headers.cookie || '');
  let cookieTok = '';
  for (const part of cookies.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === COOKIE) {
      try {
        cookieTok = decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        cookieTok = part.slice(idx + 1).trim();
      }
    }
  }
  const token = String(headerTok || cookieTok || req.body?.csrfToken || '').trim();
  if (!verifyCsrfToken(token, user.id)) {
    return res.status(403).json({
      error: 'CSRF token missing or invalid. Call GET /api/csrf then send X-CSRF-Token.',
      code: 'CSRF_REJECTED',
    });
  }
  return next();
}

export { HEADER as CSRF_HEADER, COOKIE as CSRF_COOKIE };
