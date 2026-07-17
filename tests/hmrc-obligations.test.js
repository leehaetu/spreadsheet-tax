import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildObligationsPath } from '../src/lib/hmrc-sandbox.js';

describe('obligations path builder', () => {
  it('builds income-and-expenditure path with cleaned NINO', () => {
    const path = buildObligationsPath('tb 11 69 25 d');
    assert.equal(path, '/obligations/details/TB116925D/income-and-expenditure');
  });

  it('appends optional query filters', () => {
    const path = buildObligationsPath('QQ123456C', {
      typeOfBusiness: 'self-employment',
      businessId: 'XBIS12345678901',
      status: 'open',
    });
    assert.ok(path.startsWith('/obligations/details/QQ123456C/income-and-expenditure?'));
    assert.ok(path.includes('typeOfBusiness=self-employment'));
    assert.ok(path.includes('businessId=XBIS12345678901'));
    assert.ok(path.includes('status=open'));
  });

  it('omits empty query values', () => {
    const path = buildObligationsPath('AA111111A', {
      businessId: '',
      fromDate: undefined,
    });
    assert.equal(path, '/obligations/details/AA111111A/income-and-expenditure');
  });
});
