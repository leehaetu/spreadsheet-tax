/**
 * Shipped pipeline: local file buffer/text → parse → map → quarterly payloads.
 * Excel goes through isolated worker when USE_EXCEL_WORKER is not '0'.
 */

import { parseCsvText, parseWorkbookBuffer, looksLikeCsv } from './parse.js';
import { mapRowsToPeriod } from './map.js';
import { buildQuarterlyPayloads } from './payloads.js';
import { buildCustomerSummary } from './summary.js';
import { validateImport } from './validation.js';
import { processSpreadsheetIsolated } from './excel-isolated.js';
import { buildSpreadsheetCheckModel } from './spreadsheet-view.js';

/**
 * Process a local file into mapped figures and HMRC quarterly payloads.
 * Sync path for CSV / samples / unit tests. Excel buffers must use
 * {@link processLocalFileIsolated} or {@link processLocalFileAsync}.
 * @param {Buffer | string} input
 * @param {string} [filename]
 */
export function processLocalFile(input, filename = 'upload.csv', opts = {}) {
  if (typeof input === 'string') {
    return finishPipeline(parseCsvText(input), filename, opts);
  }
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.csv') || looksLikeCsv(buffer)) {
    return finishPipeline(parseCsvText(buffer.toString('utf8')), filename, opts);
  }
  throw new Error(
    'Excel files require processLocalFileIsolated() or processLocalFileAsync() (exceljs). Use CSV for sync processing.'
  );
}

/**
 * Async in-process parse (CSV or XLSX via exceljs). Prefer isolated worker for web uploads.
 * @param {Buffer | string} input
 * @param {string} [filename]
 */
export async function processLocalFileAsync(
  input,
  filename = 'upload.csv',
  opts = {}
) {
  if (typeof input === 'string') {
    return finishPipeline(parseCsvText(input), filename, opts);
  }
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.csv') || looksLikeCsv(buffer)) {
    return finishPipeline(parseCsvText(buffer.toString('utf8')), filename, opts);
  }
  const rows = await parseWorkbookBuffer(buffer, filename);
  return finishPipeline(rows, filename, opts);
}

/**
 * Async path: quarantine + isolated Excel worker for customer uploads.
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @param {{ userId?: string|null, firmId?: string|null }} [opts]
 */
export async function processLocalFileIsolated(
  buffer,
  filename = 'upload.xlsx',
  opts = {}
) {
  const { rows, quarantine, kind, sha256 } = await processSpreadsheetIsolated(
    buffer,
    filename,
    opts
  );
  const result = finishPipeline(rows, filename, {
    fileSha256: sha256,
    previousCheck: opts.previousCheck || null,
  });
  return {
    ...result,
    quarantine,
    fileKind: kind,
    fileSha256: sha256,
  };
}

/**
 * @param {Record<string, string>[]} rows
 * @param {string} filename
 * @param {{ fileSha256?: string|null, previousCheck?: object|null }} [extra]
 */
function finishPipeline(rows, filename, extra = {}) {
  const mapped = mapRowsToPeriod(rows);
  const payloads = buildQuarterlyPayloads(mapped);
  const summary = buildCustomerSummary(mapped, payloads);
  const validation = validateImport(mapped, payloads);
  const spreadsheetCheck = buildSpreadsheetCheckModel(
    mapped,
    payloads,
    rows,
    {
      filename,
      fileSha256: extra.fileSha256 || null,
      mappingVersion: 'v1-deterministic',
      previousCheck: extra.previousCheck || null,
    }
  );

  return {
    rowCount: rows.length,
    mapped,
    payloads,
    summary,
    validation,
    filename,
    spreadsheetCheck,
    rawRowCount: rows.length,
  };
}
