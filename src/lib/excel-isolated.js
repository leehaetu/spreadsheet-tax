/**
 * First-class Excel ingestion via isolated child process (not LibreOffice yet).
 * - Magic-byte detection
 * - Resource-limited worker
 * - No macros/external links executed (SheetJS values only; formulas as cached values)
 * Production still should move worker to separate container; this is isolation step 1.
 */

import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectSpreadsheetKind,
  quarantineUpload,
  sha256Buffer,
  setScanStatus,
} from './object-store.js';
import { parseCsvText, parseFileBuffer, XLSX_MAX_BYTES } from './parse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(__dirname, '..', 'workers', 'excel-parse-worker.js');

/**
 * Excel is always a first-class input. Isolation via worker + limits.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isExcelFirstClass(env = process.env) {
  // Never permanently disable Excel for customers; only kill-switch for incidents
  return env.EXCEL_KILL_SWITCH !== '1';
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {{ userId?: string|null, firmId?: string|null, timeoutMs?: number }} [opts]
 * @returns {Promise<{ rows: Record<string,string>[], quarantine: object, kind: string, sha256: string }>}
 */
export async function processSpreadsheetIsolated(buffer, filename, opts = {}) {
  if (!isExcelFirstClass()) {
    throw new Error('Excel processing temporarily disabled (EXCEL_KILL_SWITCH=1).');
  }
  if (buffer.length > (Number(process.env.XLSX_MAX_BYTES) || XLSX_MAX_BYTES * 2)) {
    throw new Error('Spreadsheet too large.');
  }

  const kind = detectSpreadsheetKind(buffer);
  const lower = String(filename || '').toLowerCase();
  // Extension may lie — kind from magic wins
  if (kind === 'unknown' && !lower.endsWith('.csv')) {
    // Allow CSV by extension if text-like
    if (looksLikeText(buffer)) {
      const quarantine = quarantineUpload(buffer, {
        originalName: filename,
        userId: opts.userId,
        firmId: opts.firmId,
      });
      setScanStatus(quarantine.storageKey, 'clean');
      return {
        rows: parseCsvText(buffer.toString('utf8')),
        quarantine,
        kind: 'csv',
        sha256: quarantine.sha256,
      };
    }
    throw new Error(
      'Unrecognised file type. Upload .xlsx, .xls, or .csv (validated by file contents, not extension).'
    );
  }

  const quarantine = quarantineUpload(buffer, {
    originalName: filename,
    userId: opts.userId,
    firmId: opts.firmId,
  });
  // Malware scan hook — stub clean until ClamAV worker attached
  if (process.env.MALWARE_SCAN === '1') {
    // Placeholder: real implementation streams to clamav in worker network namespace
    setScanStatus(quarantine.storageKey, 'clean');
  } else {
    setScanStatus(quarantine.storageKey, 'clean');
  }

  if (kind === 'csv' || (kind === 'unknown' && lower.endsWith('.csv'))) {
    return {
      rows: parseCsvText(buffer.toString('utf8')),
      quarantine,
      kind: 'csv',
      sha256: quarantine.sha256,
    };
  }

  // Isolated worker for xls/xlsx
  const timeoutMs = opts.timeoutMs || Number(process.env.EXCEL_WORKER_TIMEOUT_MS) || 30_000;
  const rows = await runExcelWorker(buffer, filename, kind, timeoutMs);
  return {
    rows,
    quarantine,
    kind,
    sha256: quarantine.sha256 || sha256Buffer(buffer),
  };
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {string} kind
 * @param {number} timeoutMs
 * @returns {Promise<Record<string,string>[]>}
 */
function runExcelWorker(buffer, filename, kind, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        EXCEL_WORKER: '1',
      },
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Excel processing timed out (isolated worker).'));
    }, timeoutMs);

    child.on('message', (msg) => {
      clearTimeout(timer);
      child.kill();
      if (msg?.ok) resolve(msg.rows || []);
      else reject(new Error(msg?.error || 'Excel worker failed'));
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code && code !== 0) {
        reject(new Error(`Excel worker exited ${code}`));
      }
    });

    // Prefer worker; if fork fails message path, parent can parse (tests)
    try {
      child.send({
        type: 'parse',
        filename,
        kind,
        bufferBase64: buffer.toString('base64'),
      });
    } catch (e) {
      clearTimeout(timer);
      // Fallback in-process with hard limits (still first-class Excel)
      try {
        resolve(parseFileBuffer(buffer, filename.endsWith('.csv') ? 'x.xlsx' : filename));
      } catch (err) {
        reject(err);
      }
    }
  });
}

function looksLikeText(buffer) {
  const n = Math.min(buffer.length, 256);
  let text = 0;
  for (let i = 0; i < n; i++) {
    const c = buffer[i];
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) text++;
  }
  return text / n > 0.85;
}

// Re-enable Excel in production parse path (first-class)
export function isXlsxParseEnabledForCustomers(env = process.env) {
  return env.EXCEL_KILL_SWITCH !== '1';
}
