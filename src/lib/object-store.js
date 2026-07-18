/**
 * Encrypted-at-rest object storage for quarantined uploads.
 * Local dir (OBJECT_STORAGE_DIR or DATA_DIR/objects) — S3 can wrap later via env.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDataDir } from './db.js';
import { encryptSecret, decryptSecret } from './crypto-secret.js';

export function getObjectRoot() {
  const root =
    process.env.OBJECT_STORAGE_DIR || path.join(getDataDir(), 'objects');
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, 'quarantine'), { recursive: true });
  fs.mkdirSync(path.join(root, 'clean'), { recursive: true });
  return root;
}

/**
 * @param {Buffer} buffer
 * @returns {string}
 */
export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Detect spreadsheet kind from magic bytes (not extension).
 * @param {Buffer} buffer
 * @returns {'csv'|'xlsx'|'xls'|'unknown'}
 */
export function detectSpreadsheetKind(buffer) {
  if (!buffer || buffer.length < 8) return 'unknown';
  // ZIP (xlsx is zip)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx';
  // OLE compound (legacy xls)
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return 'xls';
  }
  // UTF-8 / text CSV heuristic
  const sample = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8');
  if (/^[\x09\x0a\x0d\x20-\x7e,"']+/.test(sample) && sample.includes(',')) {
    return 'csv';
  }
  return 'unknown';
}

/**
 * Store buffer under quarantine, return metadata.
 * @param {Buffer} buffer
 * @param {{ originalName: string, userId?: string|null, firmId?: string|null }} meta
 */
export function quarantineUpload(buffer, meta) {
  const sha256 = sha256Buffer(buffer);
  const kind = detectSpreadsheetKind(buffer);
  const id = crypto.randomUUID();
  const key = `quarantine/${sha256.slice(0, 2)}/${sha256}-${id}`;
  const root = getObjectRoot();
  const full = path.join(root, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  // Optional envelope encryption of file contents at rest
  if (process.env.OBJECT_ENCRYPT === '1') {
    const enc = encryptSecret(buffer.toString('base64'));
    fs.writeFileSync(full + '.enc', enc, 'utf8');
  } else {
    fs.writeFileSync(full, buffer);
  }
  const record = {
    id,
    sha256,
    storageKey: process.env.OBJECT_ENCRYPT === '1' ? key + '.enc' : key,
    originalName: meta.originalName || 'upload',
    kind,
    byteSize: buffer.length,
    userId: meta.userId || null,
    firmId: meta.firmId || null,
    scanStatus: 'pending',
    encrypted: process.env.OBJECT_ENCRYPT === '1',
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(full + '.meta.json', JSON.stringify(record, null, 2));
  return record;
}

/**
 * @param {string} storageKey
 * @returns {Buffer}
 */
export function readObject(storageKey) {
  const full = path.join(getObjectRoot(), storageKey);
  if (storageKey.endsWith('.enc') || process.env.OBJECT_ENCRYPT === '1') {
    const enc = fs.readFileSync(full, 'utf8');
    return Buffer.from(decryptSecret(enc), 'base64');
  }
  return fs.readFileSync(full);
}

/**
 * Mark scan result (malware stub — plug ClamAV in worker).
 * @param {string} storageKey
 * @param {'clean'|'infected'|'error'} status
 */
export function setScanStatus(storageKey, status) {
  const metaPath = path.join(
    getObjectRoot(),
    storageKey.replace(/\.enc$/, '') + '.meta.json'
  );
  if (!fs.existsSync(metaPath)) return null;
  const record = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  record.scanStatus = status;
  record.scannedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(record, null, 2));
  return record;
}
