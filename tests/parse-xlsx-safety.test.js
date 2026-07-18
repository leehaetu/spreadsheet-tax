/**
 * Spreadsheet parser controls after SheetJS removal (exceljs path).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFileBuffer,
  parseWorkbookBuffer,
  isXlsxParseEnabled,
  parseCsvText,
  XLSX_MAX_BYTES,
} from '../src/lib/parse.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('xlsx safety controls (exceljs)', () => {
  it('CSV parse always works (preferred production path)', () => {
    const rows = parseCsvText(
      'section,category,amount,period_start,period_end,tax_year\nself_employment,turnover,100,2024-04-06,2024-07-05,2024-25\n'
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].category, 'turnover');
  });

  it('Excel is first-class unless kill-switched', () => {
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', ALLOW_XLSX_PARSE: undefined }),
      true
    );
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', EXCEL_KILL_SWITCH: '1' }),
      false
    );
  });

  it('sync parseFileBuffer rejects xlsx (async path required)', () => {
    const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
    if (!fs.existsSync(xlsxPath)) return;
    const buf = fs.readFileSync(xlsxPath);
    assert.throws(
      () => parseFileBuffer(buf, '06-combined-workbook.xlsx'),
      /async|exceljs|isolated/i
    );
  });

  it('kill switch rejects async xlsx buffer', async () => {
    const prev = process.env.EXCEL_KILL_SWITCH;
    process.env.EXCEL_KILL_SWITCH = '1';
    try {
      const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
      if (!fs.existsSync(xlsxPath)) return;
      const buf = fs.readFileSync(xlsxPath);
      await assert.rejects(
        () => parseWorkbookBuffer(buf, '06-combined-workbook.xlsx'),
        /Excel|disabled|kill/i
      );
    } finally {
      if (prev != null) process.env.EXCEL_KILL_SWITCH = prev;
      else delete process.env.EXCEL_KILL_SWITCH;
    }
  });

  it('async exceljs parses fixture workbook', async () => {
    const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
    if (!fs.existsSync(xlsxPath)) return;
    const buf = fs.readFileSync(xlsxPath);
    const rows = await parseWorkbookBuffer(buf, '06-combined-workbook.xlsx');
    assert.ok(rows.length > 0);
  });

  it('documents max byte constant for controls', () => {
    assert.ok(XLSX_MAX_BYTES >= 1024 * 1024);
  });

  it('package.json does not depend on sheetjs xlsx', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    );
    assert.equal(pkg.dependencies.xlsx, undefined);
  });
});
