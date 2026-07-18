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

  it('isXlsxParseEnabled is false in production without opt-in', () => {
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', ALLOW_XLSX_PARSE: undefined }),
      false
    );
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', ALLOW_XLSX_PARSE: '1' }),
      true
    );
  });

  it('production without ALLOW_XLSX rejects xlsx buffer', () => {
    const prev = process.env.NODE_ENV;
    const prevAllow = process.env.ALLOW_XLSX_PARSE;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_XLSX_PARSE;
    try {
      const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
      if (!fs.existsSync(xlsxPath)) {
        assert.ok(true, 'xlsx fixture missing — skip body');
        return;
      }
      const buf = fs.readFileSync(xlsxPath);
      assert.throws(
        () => parseFileBuffer(buf, '06-combined-workbook.xlsx'),
        /Excel|CSV|disabled/i
      );
    } finally {
      process.env.NODE_ENV = prev;
      if (prevAllow != null) process.env.ALLOW_XLSX_PARSE = prevAllow;
      else delete process.env.ALLOW_XLSX_PARSE;
    }
  });

  it('documents max byte constant for controls', () => {
    assert.ok(XLSX_MAX_BYTES >= 1024 * 1024);
  });
});
