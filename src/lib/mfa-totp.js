/**
 * TOTP MFA foundation (practice administrators).
 * SHA-1, 30s step, 6 digits — RFC 6238 compatible with Google Authenticator.
 * Secrets stored base32; only enabled when user has enrolled.
 *
 * Fraud-prevention: only report MFA to HMRC when a real challenge succeeded
 * (see fraud-headers.js x-client-multi-factor).
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';

const STEP = 30;
const DIGITS = 6;

/**
 * @param {number} [len]
 */
export function generateTotpSecret(len = 20) {
  return base32Encode(crypto.randomBytes(len));
}

/**
 * @param {Buffer} buf
 */
function base32Encode(buf) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

/**
 * @param {string} secret
 */
function base32Decode(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = String(secret).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of cleaned) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * @param {string} secret base32
 * @param {number} [counter]
 */
export function totpAt(secret, counter = Math.floor(Date.now() / 1000 / STEP)) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * @param {string} secret
 * @param {string} code
 * @param {number} [window]
 */
export function verifyTotp(secret, code, window = 1) {
  const expected = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(expected)) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP);
  for (let w = -window; w <= window; w++) {
    if (totpAt(secret, counter + w) === expected) return true;
  }
  return false;
}

/**
 * Ensure MFA columns exist (idempotent).
 */
export function ensureMfaSchema() {
  const database = getDb();
  const cols = database
    .prepare(`PRAGMA table_info(users)`)
    .all()
    .map((c) => c.name);
  if (!cols.includes('mfa_secret')) {
    database.exec(`ALTER TABLE users ADD COLUMN mfa_secret TEXT`);
  }
  if (!cols.includes('mfa_enabled')) {
    database.exec(`ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!cols.includes('mfa_enrolled_at')) {
    database.exec(`ALTER TABLE users ADD COLUMN mfa_enrolled_at TEXT`);
  }
}

/**
 * @param {string} userId
 */
export function getMfaStatus(userId) {
  ensureMfaSchema();
  const row = getDb()
    .prepare(`SELECT mfa_enabled, mfa_secret, mfa_enrolled_at FROM users WHERE id = ?`)
    .get(userId);
  return {
    enabled: Boolean(row?.mfa_enabled),
    enrolled: Boolean(row?.mfa_secret && row?.mfa_enabled),
    enrolledAt: row?.mfa_enrolled_at || null,
  };
}

/**
 * Begin enrollment — returns secret + otpauth URL; not enabled until confirm.
 * @param {string} userId
 * @param {string} email
 */
export function beginMfaEnrollment(userId, email) {
  ensureMfaSchema();
  const secret = generateTotpSecret();
  getDb()
    .prepare(
      `UPDATE users SET mfa_secret = ?, mfa_enabled = 0, mfa_enrolled_at = NULL WHERE id = ?`
    )
    .run(secret, userId);
  const label = encodeURIComponent(`Spreadsheet Tax:${email}`);
  const issuer = encodeURIComponent('Spreadsheet Tax');
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=${DIGITS}&period=${STEP}`;
  return { secret, otpauth, digits: DIGITS, period: STEP };
}

/**
 * @param {string} userId
 * @param {string} code
 */
export function confirmMfaEnrollment(userId, code) {
  ensureMfaSchema();
  const row = getDb()
    .prepare(`SELECT mfa_secret FROM users WHERE id = ?`)
    .get(userId);
  if (!row?.mfa_secret) return { ok: false, error: 'No MFA enrollment in progress.' };
  if (!verifyTotp(row.mfa_secret, code)) {
    return { ok: false, error: 'Invalid authenticator code.' };
  }
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE users SET mfa_enabled = 1, mfa_enrolled_at = ? WHERE id = ?`
    )
    .run(now, userId);
  return { ok: true, enrolledAt: now };
}

/**
 * @param {string} userId
 * @param {string} code
 */
export function verifyUserMfa(userId, code) {
  ensureMfaSchema();
  const row = getDb()
    .prepare(`SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?`)
    .get(userId);
  if (!row?.mfa_enabled || !row.mfa_secret) {
    return { ok: false, required: false, error: 'MFA not enabled.' };
  }
  if (!verifyTotp(row.mfa_secret, code)) {
    return { ok: false, required: true, error: 'Invalid MFA code.' };
  }
  return { ok: true, required: true };
}

/**
 * @param {string} userId
 * @param {string} passwordOk already verified
 * @param {string} code
 */
export function disableMfa(userId, code) {
  const v = verifyUserMfa(userId, code);
  if (!v.ok) return v;
  getDb()
    .prepare(
      `UPDATE users SET mfa_secret = NULL, mfa_enabled = 0, mfa_enrolled_at = NULL WHERE id = ?`
    )
    .run(userId);
  return { ok: true };
}

/**
 * Practice admin MFA is required when MFA_REQUIRE_PRACTICE_ADMIN=1 and user has that role.
 * @param {string} userId
 * @param {import('better-sqlite3').Database} [database]
 */
export function practiceAdminRequiresMfa(userId) {
  if (process.env.MFA_REQUIRE_PRACTICE_ADMIN !== '1') return false;
  const row = getDb()
    .prepare(
      `SELECT 1 FROM firm_memberships WHERE user_id = ? AND role = 'practice_admin' LIMIT 1`
    )
    .get(userId);
  return Boolean(row);
}
