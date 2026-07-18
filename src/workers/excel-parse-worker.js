/**
 * Isolated Excel parse worker (child process).
 * Loads xlsx only here so main event loop stays free; still replace with
 * LibreOffice container for full production isolation.
 */

import * as XLSX from 'xlsx';

const MAX_SHEETS = Number(process.env.XLSX_MAX_SHEETS) || 8;
const MAX_ROWS = Number(process.env.XLSX_MAX_ROWS_PER_SHEET) || 5000;

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function cellToString(cell) {
  if (cell === undefined || cell === null) return '';
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) return String(cell);
  return String(cell).trim();
}

function colLetters(index) {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function sheetToRows(sheet, sheetName) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  if (!matrix.length) return [];
  const headers = /** @type {unknown[]} */ (matrix[0]).map(normalizeHeader);
  /** @type {Record<string, string>[]} */
  const rows = [];
  const limit = Math.min(matrix.length, MAX_ROWS + 1);
  for (let i = 1; i < limit; i++) {
    const cells = /** @type {unknown[]} */ (matrix[i]);
    if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue;
    /** @type {Record<string, string>} */
    const obj = Object.create(null);
    obj._sheet = sheetName || '';
    obj._row = String(i + 1);
    headers.forEach((h, idx) => {
      if (!h || h === '__proto__' || h === 'constructor') return;
      obj[h] = cellToString(cells[idx]);
      obj[`_col_${h}`] = colLetters(idx);
    });
    rows.push(obj);
  }
  return rows;
}

process.on('message', (msg) => {
  try {
    if (!msg || msg.type !== 'parse') {
      process.send?.({ ok: false, error: 'bad message' });
      return;
    }
    const buffer = Buffer.from(msg.bufferBase64 || '', 'base64');
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      raw: false,
      cellDates: false,
      sheetRows: MAX_ROWS + 1,
      // Do not enable formulas execution beyond cached values
      cellFormula: false,
    });
    /** @type {Record<string, string>[]} */
    const all = [];
    const names = (workbook.SheetNames || []).slice(0, MAX_SHEETS);
    for (const name of names) {
      const rows = sheetToRows(workbook.Sheets[name], name);
      const sectionHint = normalizeHeader(name);
      for (const row of rows) {
        row._sheet = name;
        if (!row.section && /self_employment|uk_property|foreign/.test(sectionHint)) {
          all.push({ ...row, section: sectionHint });
        } else {
          all.push(row);
        }
      }
    }
    process.send?.({ ok: true, rows: all });
  } catch (e) {
    process.send?.({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
