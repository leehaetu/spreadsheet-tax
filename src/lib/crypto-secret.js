/**
 * Symmetric encrypt/decrypt for OAuth tokens at rest.
 * Production: TOKEN_ENCRYPTION_KEY required (see production-boot.js).
 * Non-production: may fall back to SESSION_SECRET then a well-known dev key
 * (never for production boot).
 */

import crypto from 'node:crypto';
import { DEV_TOKEN_KEY } from './production-boot.js';

const ALGO = 'aes-256-gcm';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveTokenEncryptionMaterial(env = process.env) {
  if (env.TOKEN_ENCRYPTION_KEY && env.TOKEN_ENCRYPTION_KEY.length >= 16) {
    return { material: env.TOKEN_ENCRYPTION_KEY, source: 'TOKEN_ENCRYPTION_KEY' };
  }
  if (env.NODE_ENV === 'production' || env.FORCE_PRODUCTION_SAFETY === '1') {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is required when NODE_ENV=production or FORCE_PRODUCTION_SAFETY=1'
    );
  }
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 16) {
    return { material: env.SESSION_SECRET, source: 'SESSION_SECRET_FALLBACK' };
  }
  return { material: DEV_TOKEN_KEY, source: 'DEV_FALLBACK' };
}

function keyBytes() {
  const { material } = resolveTokenEncryptionMaterial();
  return crypto.createHash('sha256').update(material).digest();
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
