import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHmrcBaseUrl,
  buildSubmitRequest,
} from '../src/lib/hmrc-client.js';
import {
  taxYearFromPeriodId,
  defaultSeAnnualBody,
  isEmptySeAnnualBody,
  resolveSeAnnualBody,
} from '../src/lib/hmrc-api.js';

describe('production switch is env-only', () => {
  it('sandbox host by default', () => {
    assert.equal(
      resolveHmrcBaseUrl({ HMRC_OAUTH_ENV: 'sandbox' }),
      'https://test-api.service.hmrc.gov.uk'
    );
  });

  it('production host when HMRC_OAUTH_ENV=production', () => {
    assert.equal(
      resolveHmrcBaseUrl({ HMRC_OAUTH_ENV: 'production' }),
      'https://api.service.hmrc.gov.uk'
    );
  });

  it('explicit HMRC_BASE_URL wins', () => {
    assert.equal(
      resolveHmrcBaseUrl({
        HMRC_OAUTH_ENV: 'production',
        HMRC_BASE_URL: 'https://custom.example',
      }),
      'https://custom.example'
    );
  });
});

describe('SE amend path includes tax year', () => {
  it('PUT path has taxYear segment', () => {
    const req = buildSubmitRequest(
      {
        source: 'self_employment',
        nino: 'TB116925D',
        businessId: 'XBIS12345678901',
        taxYear: '2024-25',
        periodId: '2024-04-06_2024-07-05',
        body: { periodDates: { periodStartDate: '2024-04-06', periodEndDate: '2024-07-05' } },
      },
      { mode: 'sandbox', baseUrl: 'https://test-api.service.hmrc.gov.uk' }
    );
    assert.equal(req.method, 'PUT');
    assert.equal(
      req.path,
      '/individuals/business/self-employment/TB116925D/XBIS12345678901/period/2024-25/2024-04-06_2024-07-05'
    );
    assert.equal(taxYearFromPeriodId('2024-04-06_2024-07-05'), '2024-25');
  });
});

describe('default SE annual body is non-empty', () => {
  it('has allowances and adjustments', () => {
    const b = defaultSeAnnualBody();
    assert.ok(b.allowances);
    assert.ok(b.adjustments);
    assert.notEqual(Object.keys(b.allowances).length, 0);
  });

  it('resolveSeAnnualBody replaces empty UI payload', () => {
    assert.equal(isEmptySeAnnualBody({ adjustments: {}, allowances: {} }), true);
    const fixed = resolveSeAnnualBody({ adjustments: {}, allowances: {} });
    assert.equal(isEmptySeAnnualBody(fixed), false);
    assert.ok(fixed.allowances.annualInvestmentAllowance != null);
  });

  it('resolveSeAnnualBody keeps non-empty payload', () => {
    const input = { allowances: { tradingIncomeAllowance: 1000 }, adjustments: {} };
    const out = resolveSeAnnualBody(input);
    assert.equal(out.allowances.tradingIncomeAllowance, 1000);
  });
});
