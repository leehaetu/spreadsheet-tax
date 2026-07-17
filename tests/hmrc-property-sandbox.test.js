import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeUkPropertyPeriodBody,
  sanitizeForeignPropertyPeriodBody,
  taxYearFromPeriodStart,
} from '../src/lib/hmrc-sandbox.js';
import { buildSubmitRequest } from '../src/lib/hmrc-client.js';

describe('property sandbox body sanitizers', () => {
  it('strips periodDates from UK property body', () => {
    const clean = sanitizeUkPropertyPeriodBody({
      fromDate: '2024-04-06',
      toDate: '2024-07-05',
      ukOtherProperty: { income: { periodAmount: 1000 } },
      periodDates: { periodStartDate: '2024-04-06', periodEndDate: '2024-07-05' },
    });
    assert.deepEqual(clean, {
      fromDate: '2024-04-06',
      toDate: '2024-07-05',
      ukOtherProperty: { income: { periodAmount: 1000 } },
    });
    assert.equal('periodDates' in clean, false);
  });

  it('strips periodDates from foreign property body', () => {
    const clean = sanitizeForeignPropertyPeriodBody({
      fromDate: '2024-04-06',
      toDate: '2024-07-05',
      foreignProperty: [{ countryCode: 'ESP', income: { rentIncome: { rentAmount: 500 } } }],
      periodDates: { periodStartDate: '2024-04-06', periodEndDate: '2024-07-05' },
    });
    assert.equal(clean.foreignProperty[0].countryCode, 'ESP');
    assert.equal('periodDates' in clean, false);
  });
});

describe('taxYearFromPeriodStart', () => {
  it('maps Q1 2024-25 start to 2024-25', () => {
    assert.equal(taxYearFromPeriodStart('2024-04-06'), '2024-25');
  });

  it('maps date before 6 April into previous tax year', () => {
    assert.equal(taxYearFromPeriodStart('2025-03-31'), '2024-25');
  });

  it('falls back when missing', () => {
    assert.equal(taxYearFromPeriodStart(null), '2024-25');
  });
});

describe('property submit request paths', () => {
  it('builds UK property period path with tax year', () => {
    const req = buildSubmitRequest(
      {
        source: 'uk_property',
        nino: 'TB116925D',
        businessId: 'XPIS12345678901',
        taxYear: '2024-25',
        body: {
          fromDate: '2024-04-06',
          toDate: '2024-07-05',
          ukOtherProperty: { income: { periodAmount: 1 } },
        },
      },
      { mode: 'sandbox', baseUrl: 'https://test-api.service.hmrc.gov.uk' }
    );
    assert.equal(
      req.path,
      '/individuals/business/property/uk/TB116925D/XPIS12345678901/period/2024-25'
    );
    assert.match(req.headers.Accept, /6\.0/);
  });

  it('builds foreign property period path', () => {
    const req = buildSubmitRequest(
      {
        source: 'foreign_property',
        nino: 'TB116925D',
        businessId: 'XPIS99999999999',
        taxYear: '2024-25',
        body: {
          fromDate: '2024-04-06',
          toDate: '2024-07-05',
          foreignProperty: [],
        },
      },
      { mode: 'sandbox' }
    );
    assert.equal(
      req.path,
      '/individuals/business/property/foreign/TB116925D/XPIS99999999999/period/2024-25'
    );
  });
});
