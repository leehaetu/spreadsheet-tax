/**
 * Symmetric encrypt/decrypt for OAuth tokens at rest.
 */

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

function keyBytes() {
  const raw =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    'dev-only-spreadsheet-tax-token-key!!';
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * @param {string} plain
 */
export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * @param {string} packed
 */
export function decryptSecret(packed) {
  const buf = Buffer.from(String(packed), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8'
  );
}
