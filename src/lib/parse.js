/**
 * Parse local spreadsheet / CSV files into raw row records.
 * Supports CSV text and XLSX workbooks (first sheet or named sheets).
 */

import * as XLSX from 'xlsx';

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
 * Uses a plain parser so date-like values (e.g. 2024-04-06) are not
 * coerced into Excel serials.
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
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = (cells[idx] ?? '').trim();
    });
    rows.push(obj);
  }
  return rows;
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
/** Max sheets / rows to reduce DoS surface of xlsx parser. */
export const XLSX_MAX_SHEETS = 8;
export const XLSX_MAX_ROWS_PER_SHEET = 5000;

/**
 * Whether Excel parse is allowed (CSV is always preferred/safe).
 * Production defaults to CSV-only unless ALLOW_XLSX_PARSE=1.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isXlsxParseEnabled(env = process.env) {
  if (env.ALLOW_XLSX_PARSE === '0') return false;
  if (env.ALLOW_XLSX_PARSE === '1') return true;
  // Non-production: allow for tests and local; production: opt-in only
  return env.NODE_ENV !== 'production';
}

/**
 * Parse a Buffer (CSV or XLSX) into rows.
 * Compensating controls for vulnerable xlsx: size/sheet/row limits, optional disable.
 * Prefer CSV for untrusted production uploads.
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @returns {Record<string, string>[]}
 */
export function parseFileBuffer(buffer, filename = '') {
  const lower = filename.toLowerCase();
  const isCsv = lower.endsWith('.csv') || looksLikeCsv(buffer);

  if (isCsv && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return parseCsvText(buffer.toString('utf8'));
  }

  if (!isXlsxParseEnabled()) {
    throw new Error(
      'Excel (.xlsx) upload is disabled on this server. Export your sheet as CSV and upload that, or set ALLOW_XLSX_PARSE=1 with risk acceptance.'
    );
  }
  if (buffer.length > XLSX_MAX_BYTES) {
    throw new Error(
      `Spreadsheet too large for Excel parse (max ${XLSX_MAX_BYTES} bytes). Use CSV or a smaller file.`
    );
  }

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    cellDates: false,
    // dense/sheetRows limits reduce work on hostile workbooks
    sheetRows: XLSX_MAX_ROWS_PER_SHEET + 1,
  });
  /** @type {Record<string, string>[]} */
  const all = [];
  const names = (workbook.SheetNames || []).slice(0, XLSX_MAX_SHEETS);
  for (const name of names) {
    const rows = sheetToRows(workbook.Sheets[name]);
    const sectionHint = normalizeHeader(name);
    for (const row of rows) {
      // Prototype-pollution guard: only own enumerable string keys, stringify values
      const safe = sanitizeRow(row);
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
 * @param {XLSX.WorkSheet} sheet
 * @returns {Record<string, string>[]}
 */
function sheetToRows(sheet) {
  // raw:true keeps ISO date strings and numbers as typed; we stringify ourselves
  // so xlsx does not reformat 2024-04-06 into locale short dates.
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  if (!matrix.length) return [];

  const headers = /** @type {unknown[]} */ (matrix[0]).map(normalizeHeader);
  /** @type {Record<string, string>[]} */
  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = /** @type {unknown[]} */ (matrix[i]);
    if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue;
    /** @type {Record<string, string>} */
    const obj = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = cellToString(cells[idx]);
    });
    rows.push(obj);
  }
  return rows;
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
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    // Excel serial date heuristic (days since 1899-12-30), incl. fractional time
    if (cell > 20000 && cell < 60000) {
      const epoch = Date.UTC(1899, 11, 30);
      const wholeDays = Math.floor(cell);
      const dt = new Date(epoch + wholeDays * 86400000);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(cell);
  }
  return String(cell).trim();
}

/**
 * @param {Buffer} buffer
 */
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
]);

/**
 * @param {string} name
 */
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
 * xlsx may emit locale short dates (e.g. 4/6/24) for ISO-looking values.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeDateValue(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  // Already ISO-like
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Excel serial as string/number
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const epoch = Date.UTC(1899, 11, 30);
    const dt = new Date(epoch + Math.floor(serial) * 86400000);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // M/D/YY or M/D/YYYY (xlsx default for some locales)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    let year = Number(mdy[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = String(Number(mdy[1])).padStart(2, '0');
    const day = String(Number(mdy[2])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // D/M/YYYY common UK
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
    // Also accept columns like tax_year, period_start on any row
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
