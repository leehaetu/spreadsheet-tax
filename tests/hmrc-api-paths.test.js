import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mtdCapabilityMatrix,
  taxYearFromPeriodStart,
  taxYearFromPeriodId,
} from '../src/lib/hmrc-api.js';

describe('mtd capability matrix P1-P3', () => {
  it('exposes in-year, eoy, extras and no eops', () => {
    const m = mtdCapabilityMatrix();
    assert.equal(m.eops, false);
    assert.equal(m.goal, 'HMRC Recognised');
    assert.equal(m.inYear.sePeriodCreateRetrieveAmend, true);
    assert.equal(m.inYear.ukPropertyPeriod, true);
    assert.equal(m.inYear.foreignPropertyPeriod, true);
    assert.equal(m.inYear.calculationsTriggerListRetrieve, true);
    assert.equal(m.endOfYear.bsasTriggerListRetrieveAdjust, true);
    assert.equal(m.endOfYear.seAnnual, true);
    assert.equal(m.extras.itsaStatus, true);
    assert.equal(m.extras.biss, true);
    assert.equal(m.extras.accountsBalanceAndTransactions, true);
  });
});

describe('tax year helpers', () => {
  it('maps Q1 start', () => {
    assert.equal(taxYearFromPeriodStart('2024-04-06'), '2024-25');
  });
  it('maps periodId to tax year', () => {
    assert.equal(taxYearFromPeriodId('2024-04-06_2024-07-05'), '2024-25');
  });
});
