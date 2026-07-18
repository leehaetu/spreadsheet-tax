/**
 * "Check your spreadsheet" model — cell ↔ HMRC category proof.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processLocalFile } from '../src/lib/pipeline.js';
import { buildSpreadsheetCheckModel } from '../src/lib/spreadsheet-view.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('Check your spreadsheet', () => {
  it('builds cell references and category totals from plumber CSV', () => {
    const file = path.join(
      root,
      'test-spreadsheets/01-self-employment-plumber.csv'
    );
    const buf = fs.readFileSync(file);
    const result = processLocalFile(buf, '01-self-employment-plumber.csv');
    assert.ok(result.spreadsheetCheck);
    const sc = result.spreadsheetCheck;
    assert.ok(sc.gridRows.length > 0);
    assert.ok(sc.categories.length > 0);
    // Cell refs like Sheet1!C8
    const withCell = sc.gridRows.filter((r) => r.cell && /!/.test(r.cell));
    assert.ok(withCell.length > 0, 'expected Excel-style cell refs');
    const turnover = sc.categories.find((c) =>
      /turnover/i.test(c.field || c.label)
    );
    assert.ok(turnover);
    assert.ok(turnover.total > 0);
    assert.ok(turnover.cellCount >= 1);
    assert.match(sc.approvalWording, /authorise Spreadsheet Tax to send to HMRC/i);
    assert.match(sc.securityNote, /sanitised|not the original Excel/i);
  });

  it('selecting a category can list contributing cells', () => {
    const file = path.join(
      root,
      'test-spreadsheets/01-self-employment-plumber.csv'
    );
    const result = processLocalFile(
      fs.readFileSync(file),
      '01-self-employment-plumber.csv'
    );
    const sc = result.spreadsheetCheck;
    const cat = sc.categories[0];
    const cells = sc.gridRows.filter((r) => r.categoryId === cat.id);
    assert.equal(cells.length, cat.cellCount);
  });

  it('does not invent mapState other than included for mapped lines', () => {
    const file = path.join(
      root,
      'test-spreadsheets/04-combined-trade-and-property.csv'
    );
    const result = processLocalFile(
      fs.readFileSync(file),
      '04-combined-trade-and-property.csv'
    );
    for (const r of result.spreadsheetCheck.gridRows) {
      assert.equal(r.mapState, 'included');
    }
  });
});
