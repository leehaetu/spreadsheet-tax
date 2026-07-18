/**
 * Parse local spreadsheet / CSV files into raw row records.
 * CSV: sync pure JS. XLSX: exceljs (SheetJS removed — CVE residual closed).
 * Legacy .xls is not supported (save as .xlsx or CSV).
 */

import ExcelJS from 'exceljs';

/**
 * Normalize a header cell to a stable key.
 * @param {unknown} h
 * @returns {string}
 */
export function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * Parse CSV text into array of objects keyed by header row.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsvText(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!lines.length) return [];
  const headerCells = splitCsvLine(lines[0]);
  const headers = headerCells.map(normalizeHeader);
  /** @type {Record<string, string>[]} */
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.every((c) => !c.trim())) continue;
    /** @type {Record<string, string>} */
    const obj = {
      _sheet: 'Sheet1',
      _row: String(i + 1),
    };
    headers.forEach((h, idx) => {
      if (!h || h === '__proto__' || h === 'constructor' || h === 'prototype') return;
      obj[h] = (cells[idx] ?? '').trim();
      obj[`_col_${h}`] = colLetters(idx);
    });
    rows.push(obj);
  }
  return rows;
}

/** 0-based column index → Excel letters */
export function colLetters(index) {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Split one CSV line respecting double-quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  /** @type {string[]} */
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** Max workbook size (bytes) for XLSX path — untrusted upload control. */
export const XLSX_MAX_BYTES = 2 * 1024 * 1024;
export const XLSX_MAX_SHEETS = 8;
export const XLSX_MAX_ROWS_PER_SHEET = 5000;

/**
 * Excel parse enabled unless kill-switched.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isXlsxParseEnabled(env = process.env) {
  if (env.EXCEL_KILL_SWITCH === '1') return false;
  if (env.ALLOW_XLSX_PARSE === '0') return false;
  return true;
}

/**
 * Sync buffer parse: **CSV only**. Excel must use {@link parseWorkbookBuffer} (async exceljs).
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @returns {Record<string, string>[]}
 */
export function parseFileBuffer(buffer, filename = '') {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
    throw new Error(
      'Legacy .xls is not supported. Save as .xlsx or CSV and upload again.'
    );
  }
  if (
    lower.endsWith('.xlsx') ||
    (!looksLikeCsv(buffer) && !lower.endsWith('.csv'))
  ) {
    // Keep kill-switch behaviour for sync callers (tests)
    if (!isXlsxParseEnabled()) {
      throw new Error(
        'Excel processing disabled (EXCEL_KILL_SWITCH or ALLOW_XLSX_PARSE=0).'
      );
    }
    throw new Error(
      'Excel files require async parseWorkbookBuffer / processLocalFileIsolated (exceljs). Use CSV for sync parse.'
    );
  }
  return parseCsvText(buffer.toString('utf8'));
}

/**
 * Async XLSX parse via exceljs (replaces vulnerable SheetJS/xlsx package).
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @returns {Promise<Record<string, string>[]>}
 */
export async function parseWorkbookBuffer(buffer, filename = '') {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
    throw new Error(
      'Legacy .xls is not supported. Save as .xlsx or CSV and upload again.'
    );
  }
  if (!isXlsxParseEnabled()) {
    throw new Error(
      'Excel processing disabled (EXCEL_KILL_SWITCH or ALLOW_XLSX_PARSE=0).'
    );
  }
  if (buffer.length > XLSX_MAX_BYTES) {
    throw new Error(
      `Spreadsheet too large for Excel parse (max ${XLSX_MAX_BYTES} bytes). Use CSV or a smaller file.`
    );
  }

  const workbook = new ExcelJS.Workbook();
  // exceljs loads OOXML only — no macro execution
  await workbook.xlsx.load(buffer);

  /** @type {Record<string, string>[]} */
  const all = [];
  const sheets = workbook.worksheets.slice(0, XLSX_MAX_SHEETS);
  for (const sheet of sheets) {
    const sectionHint = normalizeHeader(sheet.name);
    const rows = worksheetToRows(sheet);
    for (const row of rows) {
      const safe = sanitizeRow(row);
      safe._sheet = sheet.name || '';
      if (!safe.section && isKnownSection(sectionHint)) {
        all.push({ ...safe, section: sectionHint });
      } else {
        all.push(safe);
      }
    }
  }
  return all;
}

/**
 * @param {import('exceljs').Worksheet} sheet
 * @returns {Record<string, string>[]}
 */
function worksheetToRows(sheet) {
  /** @type {Record<string, string>[]} */
  const rows = [];
  /** @type {string[]} */
  let headers = [];
  let rowCount = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowCount >= XLSX_MAX_ROWS_PER_SHEET + 1) return;
    rowCount++;
    const values = /** @type {unknown[]} */ (row.values || []);
    // exceljs row.values is 1-indexed
    const cells = values.slice(1);
    if (rowNumber === 1 || headers.length === 0) {
      headers = cells.map((c) => normalizeHeader(cellToString(c)));
      return;
    }
    if (cells.every((c) => !String(cellToString(c) || '').trim())) return;
    /** @type {Record<string, string>} */
    const obj = Object.create(null);
    obj._row = String(rowNumber);
    headers.forEach((h, idx) => {
      if (!h || h === '__proto__' || h === 'constructor' || h === 'prototype')
        return;
      obj[h] = cellToString(cells[idx]);
      obj[`_col_${h}`] = colLetters(idx);
    });
    rows.push(obj);
  });
  return rows;
}

/**
 * @param {Record<string, string>} row
 * @returns {Record<string, string>}
 */
function sanitizeRow(row) {
  /** @type {Record<string, string>} */
  const out = Object.create(null);
  for (const key of Object.keys(row || {})) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype')
      continue;
    if (typeof key !== 'string') continue;
    out[key] = String(row[key] ?? '');
  }
  return out;
}

/**
 * @param {unknown} cell
 * @returns {string}
 */
function cellToString(cell) {
  if (cell === undefined || cell === null) return '';
  if (cell instanceof Date) {
    const y = cell.getUTCFullYear();
    const m = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cell.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof cell === 'object' && cell !== null && 'text' in cell) {
    return String(/** @type {{ text?: unknown }} */ (cell).text ?? '').trim();
  }
  if (typeof cell === 'object' && cell !== null && 'result' in cell) {
    return cellToString(/** @type {{ result?: unknown }} */ (cell).result);
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return String(cell);
  }
  return String(cell).trim();
}

function looksLikeCsv(buffer) {
  const sample = buffer.slice(0, 200).toString('utf8');
  return sample.includes(',') || sample.includes(';') || sample.includes('\n');
}

const KNOWN_SECTIONS = new Set([
  'self_employment',
  'self-employment',
  'se',
  'uk_property',
  'uk-property',
  'ukproperty',
  'foreign_property',
  'foreign-property',
  'foreignproperty',
  'meta',
  'metadata',
  'period_summary',
]);

function isKnownSection(name) {
  return KNOWN_SECTIONS.has(name);
}

const DATE_META_KEYS = new Set([
  'period_start',
  'period_end',
  'accounting_period_start',
  'accounting_period_end',
]);

/**
 * Normalize spreadsheet date cells to YYYY-MM-DD when possible.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeDateValue(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const epoch = Date.UTC(1899, 11, 30);
    const dt = new Date(epoch + Math.floor(serial) * 86400000);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = String(Number(mdy[1])).padStart(2, '0');
    const day = String(Number(mdy[2])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const day = String(Number(dmy[1])).padStart(2, '0');
    const month = String(Number(dmy[2])).padStart(2, '0');
    return `${dmy[3]}-${month}-${day}`;
  }
  return s;
}

/**
 * Collect metadata fields from rows with section meta/metadata or bare key rows.
 * @param {Record<string, string>[]} rows
 * @returns {Record<string, string>}
 */
export function extractMetadata(rows) {
  /** @type {Record<string, string>} */
  const meta = {};
  for (const row of rows) {
    const section = normalizeHeader(row.section || '');
    if (section === 'meta' || section === 'metadata') {
      const field = normalizeHeader(row.field || row.key || '');
      if (field && row.value !== undefined) {
        const val = String(row.value);
        meta[field] = DATE_META_KEYS.has(field) ? normalizeDateValue(val) : val;
      }
      continue;
    }
    for (const key of [
      'tax_year',
      'period_start',
      'period_end',
      'business_id',
      'nino',
      'accounting_period_start',
      'accounting_period_end',
    ]) {
      if (row[key] && !meta[key]) {
        const val = String(row[key]);
        meta[key] = DATE_META_KEYS.has(key) ? normalizeDateValue(val) : val;
      }
    }
  }
  return meta;
}

export { looksLikeCsv };
