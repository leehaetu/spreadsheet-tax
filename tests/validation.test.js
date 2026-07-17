import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processLocalFile } from '../src/lib/pipeline.js';
import { validateSubmission } from '../src/lib/validation.js';

describe('spreadsheet readiness validation', () => {
  it('accepts a valid self-employment period and reports no blocking errors', () => {
    const csv = [
      'section,field,value,country',
      'meta,tax_year,2026-27,',
      'meta,period_start,2026-04-06,',
      'meta,period_end,2026-07-05,',
      'self_employment,turnover,12000,',
      'self_employment,professional_fees,500,',
    ].join('\n');
    const result = processLocalFile(csv, 'valid.csv');
    assert.equal(result.validation.ready, true);
    assert.deepEqual(result.validation.errors, []);
  });

  it('blocks foreign property without a country code', () => {
    const csv = [
      'section,field,value,country',
      'meta,tax_year,2026-27,',
      'meta,period_start,2026-04-06,',
      'meta,period_end,2026-07-05,',
      'foreign_property,rent_income,4000,',
    ].join('\n');
    const result = processLocalFile(csv, 'missing-country.csv');
    assert.equal(result.validation.ready, false);
    assert.ok(result.validation.errors.some((x) => x.code === 'INVALID_COUNTRY'));
  });

  it('warns about unknown categories and negative amounts', () => {
    const csv = [
      'section,field,value',
      'meta,tax_year,2026-27',
      'meta,period_start,2026-04-06',
      'meta,period_end,2026-07-05',
      'self_employment,turnover,1000',
      'self_employment,mystery_cost,-25',
    ].join('\n');
    const result = processLocalFile(csv, 'warnings.csv');
    assert.ok(result.validation.warnings.some((x) => x.code === 'UNRECOGNISED_CATEGORY'));
    assert.ok(result.validation.warnings.some((x) => x.code === 'NEGATIVE_AMOUNT'));
  });
});

describe('submission validation', () => {
  const payloads = {
    meta: { taxYear: '2026-27' },
    selfEmployment: { periodIncome: { turnover: 1000 } },
    ukProperty: null,
    foreignProperty: null,
  };

  it('normalizes valid identifiers', () => {
    const result = validateSubmission(payloads, {
      nino: 'aa 12 34 56 a',
      businessIdSe: 'XAIS12345678901',
      taxYear: '2026-27',
    });
    assert.equal(result.ready, true);
    assert.equal(result.normalized.nino, 'AA123456A');
  });

  it('blocks missing or malformed identifiers', () => {
    const result = validateSubmission(payloads, {
      nino: 'not-a-nino',
      businessIdSe: '',
      taxYear: '26/27',
    });
    assert.equal(result.ready, false);
    assert.ok(result.errors.some((x) => x.code === 'INVALID_NINO'));
    assert.ok(result.errors.some((x) => x.code === 'INVALID_BUSINESS_ID'));
    assert.ok(result.errors.some((x) => x.code === 'INVALID_TAX_YEAR'));
  });
});
