/**
 * Spreadsheet parser compensating controls for untrusted uploads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFileBuffer,
  isXlsxParseEnabled,
  parseCsvText,
  XLSX_MAX_BYTES,
} from '../src/lib/parse.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('xlsx safety controls', () => {
  it('CSV parse always works (preferred production path)', () => {
    const rows = parseCsvText(
      'section,category,amount,period_start,period_end,tax_year\nself_employment,turnover,100,2024-04-06,2024-07-05,2024-25\n'
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].category, 'turnover');
  });

  it('Excel is first-class in production unless kill-switched', () => {
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', ALLOW_XLSX_PARSE: undefined }),
      true
    );
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', EXCEL_KILL_SWITCH: '1' }),
      false
    );
  });

  it('kill switch rejects xlsx buffer', () => {
    const prev = process.env.EXCEL_KILL_SWITCH;
    process.env.EXCEL_KILL_SWITCH = '1';
    try {
      const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
      if (!fs.existsSync(xlsxPath)) {
        assert.ok(true, 'xlsx fixture missing — skip body');
        return;
      }
      const buf = fs.readFileSync(xlsxPath);
      assert.throws(
        () => parseFileBuffer(buf, '06-combined-workbook.xlsx'),
        /Excel|disabled|kill/i
      );
    } finally {
      if (prev != null) process.env.EXCEL_KILL_SWITCH = prev;
      else delete process.env.EXCEL_KILL_SWITCH;
    }
  });

  it('documents max byte constant for controls', () => {
    assert.ok(XLSX_MAX_BYTES >= 1024 * 1024);
  });
});
