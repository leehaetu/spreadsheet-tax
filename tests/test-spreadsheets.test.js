/**
 * Drive shipped pipeline on test-spreadsheets/* files.
 * Expected values derived from each file's own rows — not hardcoded blobs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processLocalFile } from '../src/lib/pipeline.js';
import { parseCsvText } from '../src/lib/parse.js';
import { parseMoney } from '../src/lib/map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '..', 'test-spreadsheets');

function expectedFromCsv(csvText, section, country) {
  const rows = parseCsvText(csvText);
  /** @type {Record<string, number>} */
  const expected = {};
  for (const row of rows) {
    if ((row.section || '').toLowerCase() !== section) continue;
    if (country && (row.country || '').toUpperCase() !== country.toUpperCase())
      continue;
    const field = (row.field || '').toLowerCase().replace(/\s+/g, '_');
    if (!field) continue;
    const v = parseMoney(row.value);
    if (v === undefined) continue;
    expected[field] = (expected[field] ?? 0) + v;
  }
  return expected;
}

describe('test-spreadsheets folder', () => {
  it('contains required scenario files', () => {
    assert.ok(fs.existsSync(testDir), 'test-spreadsheets/ must exist');
    const names = fs.readdirSync(testDir);
    for (const need of [
      '01-self-employment-plumber.csv',
      '02-uk-property-landlord.csv',
      '03-foreign-property-spain.csv',
      '04-combined-trade-and-property.csv',
      '05-hairdresser-trade.csv',
      '06-combined-workbook.xlsx',
    ]) {
      assert.ok(names.includes(need), `missing ${need}`);
      const st = fs.statSync(path.join(testDir, need));
      assert.ok(st.size > 50, `${need} must not be empty`);
    }
  });
});

describe('processLocalFile on test-spreadsheets', () => {
  it('01 self-employment plumber maps turnover from file', () => {
    const file = path.join(testDir, '01-self-employment-plumber.csv');
    const csv = fs.readFileSync(file, 'utf8');
    const exp = expectedFromCsv(csv, 'self_employment');
    const result = processLocalFile(Buffer.from(csv), path.basename(file));
    assert.ok(result.mapped.selfEmployment);
    assert.equal(result.mapped.selfEmployment.figures.turnover, exp.turnover);
    assert.equal(
      result.payloads.selfEmployment.periodIncome.turnover,
      exp.turnover
    );
    assert.equal(
      result.payloads.selfEmployment.periodExpenses.costOfGoods,
      exp.cost_of_goods
    );
  });

  it('02 UK property keeps other_income separate from other', () => {
    const file = path.join(testDir, '02-uk-property-landlord.csv');
    const csv = fs.readFileSync(file, 'utf8');
    const exp = expectedFromCsv(csv, 'uk_property');
    const result = processLocalFile(Buffer.from(csv), path.basename(file));
    assert.equal(result.mapped.ukProperty.figures.other_income, exp.other_income);
    assert.equal(result.mapped.ukProperty.figures.other, exp.other);
    assert.equal(
      result.payloads.ukProperty.ukOtherProperty.income.otherIncome,
      exp.other_income
    );
    assert.equal(
      result.payloads.ukProperty.ukOtherProperty.expenses.other,
      exp.other
    );
    assert.equal(
      result.payloads.ukProperty.ukOtherProperty.income.periodAmount,
      exp.period_amount
    );
  });

  it('03 foreign property Spain maps rent_income', () => {
    const file = path.join(testDir, '03-foreign-property-spain.csv');
    const csv = fs.readFileSync(file, 'utf8');
    const exp = expectedFromCsv(csv, 'foreign_property', 'ESP');
    const result = processLocalFile(Buffer.from(csv), path.basename(file));
    assert.equal(result.mapped.foreignProperty[0].countryCode, 'ESP');
    // other + other_property_income both fold to other_property_income for foreign
    assert.equal(
      result.payloads.foreignProperty.foreignProperty[0].income.rentIncome
        .rentAmount,
      exp.rent_income
    );
  });

  it('04 combined produces SE + UK + foreign payloads', () => {
    const file = path.join(testDir, '04-combined-trade-and-property.csv');
    const csv = fs.readFileSync(file, 'utf8');
    const se = expectedFromCsv(csv, 'self_employment');
    const uk = expectedFromCsv(csv, 'uk_property');
    const result = processLocalFile(Buffer.from(csv), path.basename(file));
    assert.equal(
      result.payloads.selfEmployment.periodIncome.turnover,
      se.turnover
    );
    assert.equal(
      result.payloads.ukProperty.ukOtherProperty.income.periodAmount,
      uk.period_amount
    );
    assert.equal(
      result.payloads.ukProperty.ukOtherProperty.income.otherIncome,
      uk.other_income
    );
    assert.ok(result.payloads.foreignProperty.foreignProperty.length >= 1);
  });

  it('05 hairdresser aliases map sales→turnover', () => {
    const file = path.join(testDir, '05-hairdresser-trade.csv');
    const csv = fs.readFileSync(file, 'utf8');
    const rows = parseCsvText(csv);
    const salesRow = rows.find(
      (r) => r.section === 'self_employment' && r.field === 'sales'
    );
    const sales = parseMoney(salesRow.value);
    const result = processLocalFile(Buffer.from(csv), path.basename(file));
    assert.equal(result.mapped.selfEmployment.figures.turnover, sales);
    assert.equal(result.payloads.selfEmployment.periodIncome.turnover, sales);
  });

  it('06 xlsx workbook imports through shipped path', async () => {
    const file = path.join(testDir, '06-combined-workbook.xlsx');
    const buf = fs.readFileSync(file);
    const { processLocalFileIsolated } = await import('../src/lib/pipeline.js');
    const result = await processLocalFileIsolated(buf, path.basename(file));
    assert.ok(
      result.mapped.selfEmployment ||
        result.mapped.ukProperty ||
        result.mapped.foreignProperty.length,
      'xlsx must map at least one source'
    );
    assert.ok(
      result.payloads.selfEmployment ||
        result.payloads.ukProperty ||
        result.payloads.foreignProperty
    );
  });
});
