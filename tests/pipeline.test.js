/**
 * Unit tests drive the shipped parse → map → payload pipeline
 * with fixture files. Expected values are derived from fixture inputs
 * (not hardcoded independent blobs that ignore the file).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processLocalFile } from '../src/lib/pipeline.js';
import { parseCsvText } from '../src/lib/parse.js';
import { mapRowsToPeriod, parseMoney } from '../src/lib/map.js';
import {
  buildQuarterlyPayloads,
  buildSelfEmploymentPeriodSummary,
  buildUkPropertyPeriodSummary,
  buildForeignPropertyPeriodSummary,
} from '../src/lib/payloads.js';
import {
  buildSubmitRequest,
  createHmrcClient,
  resolveConfig,
} from '../src/lib/hmrc-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '..', 'fixtures');

/**
 * Read expected money values from a fixture CSV for a section (and optional country).
 * This is the ground truth: fixture file itself, not a parallel hardcoded blob.
 */
function expectedFromFixture(csvText, section, country) {
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

describe('processLocalFile — self-employment fixture', () => {
  const filePath = path.join(fixtures, 'self-employment-only.csv');
  const csv = fs.readFileSync(filePath, 'utf8');
  const expected = expectedFromFixture(csv, 'self_employment');

  it('maps turnover and expenses from the fixture file', () => {
    const result = processLocalFile(Buffer.from(csv), 'self-employment-only.csv');
    assert.ok(result.mapped.selfEmployment, 'SE section present');
    const figs = result.mapped.selfEmployment.figures;
    assert.equal(figs.turnover, expected.turnover);
    assert.equal(figs.other, expected.other);
    assert.equal(figs.cost_of_goods, expected.cost_of_goods);
    assert.equal(figs.car_van_travel_expenses, expected.car_van_travel_expenses);
    assert.equal(figs.premises_running_costs, expected.premises_running_costs);
    assert.equal(figs.professional_fees, expected.professional_fees);
    assert.equal(figs.other_expenses, expected.other_expenses);
  });

  it('builds SE period summary payload matching fixture values', () => {
    const result = processLocalFile(Buffer.from(csv), 'self-employment-only.csv');
    const body = result.payloads.selfEmployment;
    assert.ok(body);
    assert.equal(body.periodIncome.turnover, expected.turnover);
    assert.equal(body.periodIncome.other, expected.other);
    assert.equal(body.periodExpenses.costOfGoods, expected.cost_of_goods);
    assert.equal(
      body.periodExpenses.carVanTravelExpenses,
      expected.car_van_travel_expenses
    );
    assert.equal(
      body.periodExpenses.premisesRunningCosts,
      expected.premises_running_costs
    );
    assert.equal(body.periodExpenses.professionalFees, expected.professional_fees);
    assert.equal(body.periodExpenses.otherExpenses, expected.other_expenses);
    assert.equal(body.periodDates.periodStartDate, '2024-04-06');
    assert.equal(body.periodDates.periodEndDate, '2024-07-05');
  });

  it('records digital links from file fields to payload paths', () => {
    const result = processLocalFile(Buffer.from(csv), 'self-employment-only.csv');
    const turnLink = result.payloads.linkIndex.find(
      (l) => l.sourceField === 'turnover' && l.source === 'self_employment'
    );
    assert.ok(turnLink);
    assert.equal(turnLink.path, 'periodIncome.turnover');
    assert.equal(turnLink.value, expected.turnover);
  });
});

describe('processLocalFile — UK property fixture', () => {
  const filePath = path.join(fixtures, 'uk-property-only.csv');
  const csv = fs.readFileSync(filePath, 'utf8');
  const expected = expectedFromFixture(csv, 'uk_property');

  it('maps UK property income/expenses from fixture', () => {
    const result = processLocalFile(Buffer.from(csv), 'uk-property-only.csv');
    assert.ok(result.mapped.ukProperty);
    const figs = result.mapped.ukProperty.figures;
    assert.equal(figs.period_amount, expected.period_amount);
    assert.equal(figs.premiums_of_lease_grant, expected.premiums_of_lease_grant);
    assert.equal(figs.repairs_and_maintenance, expected.repairs_and_maintenance);
    assert.equal(figs.financial_costs, expected.financial_costs);
  });

  it('builds UK property payload matching fixture', () => {
    const result = processLocalFile(Buffer.from(csv), 'uk-property-only.csv');
    const body = result.payloads.ukProperty;
    assert.ok(body);
    assert.equal(
      body.ukOtherProperty.income.periodAmount,
      expected.period_amount
    );
    assert.equal(
      body.ukOtherProperty.income.premiumsOfLeaseGrant,
      expected.premiums_of_lease_grant
    );
    assert.equal(
      body.ukOtherProperty.expenses.repairsAndMaintenance,
      expected.repairs_and_maintenance
    );
    assert.equal(
      body.ukOtherProperty.expenses.financialCosts,
      expected.financial_costs
    );
    assert.equal(body.fromDate, '2024-04-06');
    assert.equal(body.toDate, '2024-07-05');
  });
});

describe('processLocalFile — foreign property fixture', () => {
  const filePath = path.join(fixtures, 'foreign-property-only.csv');
  const csv = fs.readFileSync(filePath, 'utf8');
  const expected = expectedFromFixture(csv, 'foreign_property', 'ESP');

  it('maps foreign property by country from fixture', () => {
    const result = processLocalFile(Buffer.from(csv), 'foreign-property-only.csv');
    assert.equal(result.mapped.foreignProperty.length, 1);
    assert.equal(result.mapped.foreignProperty[0].countryCode, 'ESP');
    const figs = result.mapped.foreignProperty[0].figures;
    assert.equal(figs.rent_income, expected.rent_income);
    assert.equal(figs.other_property_income, expected.other_property_income);
    assert.equal(figs.premises_running_costs, expected.premises_running_costs);
  });

  it('builds foreign property payload matching fixture', () => {
    const result = processLocalFile(Buffer.from(csv), 'foreign-property-only.csv');
    const body = result.payloads.foreignProperty;
    assert.ok(body);
    assert.equal(body.foreignProperty.length, 1);
    const fp = body.foreignProperty[0];
    assert.equal(fp.countryCode, 'ESP');
    assert.equal(fp.income.rentIncome.rentAmount, expected.rent_income);
    assert.equal(fp.income.otherPropertyIncome, expected.other_property_income);
    assert.equal(
      fp.expenses.premisesRunningCosts,
      expected.premises_running_costs
    );
    assert.equal(fp.expenses.repairsAndMaintenance, expected.repairs_and_maintenance);
  });
});

describe('processLocalFile — combined sources fixture', () => {
  const filePath = path.join(fixtures, 'combined-all-sources.csv');
  const csv = fs.readFileSync(filePath, 'utf8');

  it('produces SE + UK + foreign payloads from one file', () => {
    const result = processLocalFile(Buffer.from(csv), 'combined-all-sources.csv');
    const seExp = expectedFromFixture(csv, 'self_employment');
    const ukExp = expectedFromFixture(csv, 'uk_property');
    const fpExp = expectedFromFixture(csv, 'foreign_property', 'DEU');

    assert.equal(result.payloads.selfEmployment.periodIncome.turnover, seExp.turnover);
    assert.equal(
      result.payloads.selfEmployment.periodExpenses.costOfGoods,
      seExp.cost_of_goods
    );
    assert.equal(
      result.payloads.ukProperty.ukOtherProperty.income.periodAmount,
      ukExp.period_amount
    );
    assert.equal(
      result.payloads.foreignProperty.foreignProperty[0].income.rentIncome.rentAmount,
      fpExp.rent_income
    );
    // foreign "other" maps to other_property_income
    assert.equal(
      result.payloads.foreignProperty.foreignProperty[0].income.otherPropertyIncome,
      fpExp.other ?? fpExp.other_property_income
    );
  });
});

describe('payload builders (direct)', () => {
  it('buildSelfEmploymentPeriodSummary uses provided figures', () => {
    const figures = { turnover: 1234.56, cost_of_goods: 100 };
    const body = buildSelfEmploymentPeriodSummary(figures, {
      periodStartDate: '2024-04-06',
      periodEndDate: '2024-07-05',
    });
    assert.equal(body.periodIncome.turnover, 1234.56);
    assert.equal(body.periodExpenses.costOfGoods, 100);
  });

  it('buildUkPropertyPeriodSummary uses provided figures', () => {
    const figures = { period_amount: 999, other: 11 };
    const body = buildUkPropertyPeriodSummary(figures, {
      periodStartDate: '2024-04-06',
      periodEndDate: '2024-07-05',
    });
    assert.equal(body.ukOtherProperty.income.periodAmount, 999);
    assert.equal(body.ukOtherProperty.expenses.other, 11);
  });

  it('buildForeignPropertyPeriodSummary uses provided figures', () => {
    const body = buildForeignPropertyPeriodSummary(
      [{ countryCode: 'FRA', figures: { rent_income: 777 } }],
      { periodStartDate: '2024-04-06', periodEndDate: '2024-07-05' }
    );
    assert.equal(body.foreignProperty[0].income.rentIncome.rentAmount, 777);
  });
});

describe('HMRC client interface', () => {
  it('buildSubmitRequest produces SE path and body shape', () => {
    const body = { periodIncome: { turnover: 1 }, periodDates: {} };
    const req = buildSubmitRequest(
      {
        source: 'self_employment',
        nino: 'AA123456A',
        businessId: 'XAIS1',
        taxYear: '2024-25',
        body,
      },
      { mode: 'double', baseUrl: 'https://test-api.service.hmrc.gov.uk' }
    );
    assert.equal(req.method, 'POST');
    assert.match(req.path, /self-employment\/AA123456A\/XAIS1\/period/);
    assert.equal(req.body, body);
    assert.equal(req.headers.Accept, 'application/vnd.hmrc.1.0+json');
  });

  it('buildSubmitRequest produces UK and foreign property paths', () => {
    const uk = buildSubmitRequest(
      {
        source: 'uk_property',
        nino: 'AA123456A',
        businessId: 'XPIS1',
        taxYear: '2024-25',
        body: { x: 1 },
      },
      { mode: 'double' }
    );
    assert.match(uk.path, /property\/uk\/AA123456A\/XPIS1\/period\/2024-25/);

    const fp = buildSubmitRequest(
      {
        source: 'foreign_property',
        nino: 'AA123456A',
        businessId: 'XFIS1',
        taxYear: '2024-25',
        body: { y: 2 },
      },
      { mode: 'double' }
    );
    assert.match(fp.path, /property\/foreign\/AA123456A\/XFIS1\/period\/2024-25/);
  });

  it('test double submitBundle accepts combined payloads from fixture pipeline', async () => {
    const csv = fs.readFileSync(
      path.join(fixtures, 'combined-all-sources.csv'),
      'utf8'
    );
    const { payloads } = processLocalFile(Buffer.from(csv), 'combined-all-sources.csv');
    const client = createHmrcClient({ mode: 'double' });
    assert.equal(client.mode, 'double');
    const results = await client.submitBundle(payloads, {
      nino: 'AA123456A',
      businessIdSe: 'XAIS1',
      businessIdUk: 'XPIS1',
      businessIdForeign: 'XFIS1',
    });
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => r.ok && r.mode === 'double'));
    const se = results.find((r) => r.request.source === 'self_employment');
    assert.equal(
      se.request.body.periodIncome.turnover,
      payloads.selfEmployment.periodIncome.turnover
    );
  });

  it('resolveConfig defaults to double without client id', () => {
    const prev = process.env.HMRC_CLIENT_ID;
    const prevMode = process.env.HMRC_MODE;
    delete process.env.HMRC_CLIENT_ID;
    delete process.env.HMRC_MODE;
    try {
      const cfg = resolveConfig({});
      assert.equal(cfg.mode, 'double');
    } finally {
      if (prev !== undefined) process.env.HMRC_CLIENT_ID = prev;
      if (prevMode !== undefined) process.env.HMRC_MODE = prevMode;
    }
  });
});

describe('mapRowsToPeriod aliases', () => {
  it('accepts sales as turnover alias', () => {
    const mapped = mapRowsToPeriod([
      { section: 'self_employment', field: 'sales', value: '500' },
    ]);
    assert.equal(mapped.selfEmployment.figures.turnover, 500);
    const payloads = buildQuarterlyPayloads(mapped);
    assert.equal(payloads.selfEmployment.periodIncome.turnover, 500);
  });
});
