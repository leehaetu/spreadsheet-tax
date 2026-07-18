/**
 * Unified SE + UK + foreign taxpayer journey APIs.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-tj-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'tj.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');
const {
  buildCumulativeReview,
  buildNilPayload,
  mapHmrcBusinessesToSources,
} = await import('../src/lib/taxpayer-journey.js');

let server;
let port;
let cookie = '';

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body != null ? Buffer.from(body) : null;
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers },
      (res) => {
        const sc = res.headers['set-cookie'];
        if (sc) cookie = sc.map((c) => c.split(';')[0]).join('; ');
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

before(async () => {
  await new Promise((r) => {
    server = app.listen(0, '127.0.0.1', r);
  });
  port = server.address().port;
  await request(
    'POST',
    '/api/auth/login',
    JSON.stringify({
      email: 'demo@spreadsheet-tax.example',
      password: 'DemoPass123!',
    })
  );
});

after(async () => {
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});

describe('taxpayer journey pages', () => {
  it('serves home, onboarding, records', async () => {
    for (const p of ['/home', '/onboarding', '/records']) {
      const res = await request('GET', p);
      assert.equal(res.status, 200, p);
    }
    assert.match((await request('GET', '/home')).body, /next task|Income sources/i);
    assert.match((await request('GET', '/onboarding')).body, /Who manages the tax/i);
  });
});

describe('taxpayer journey APIs', () => {
  it('saves profile and income sources for SE + UK + foreign', async () => {
    const prof = await request(
      'PUT',
      '/api/me/taxpayer-profile',
      JSON.stringify({
        manageMode: 'self',
        taxYear: '2024-25',
        periodType: 'standard',
        onboardingComplete: true,
      })
    );
    assert.equal(prof.status, 200);
    const sources = await request(
      'PUT',
      '/api/me/income-sources',
      JSON.stringify({
        sources: [
          {
            type: 'self_employment',
            label: 'Plumbing',
            nickname: "Lee's Plumbing",
            businessId: 'XBIS1',
          },
          {
            type: 'uk_property',
            label: 'UK property',
            nickname: 'Leeds flat',
            businessId: 'XZIS1',
          },
          {
            type: 'foreign_property',
            label: 'Foreign',
            nickname: 'Spain apartment',
            countryCode: 'ESP',
            businessId: 'X8IS1',
          },
        ],
      })
    );
    assert.equal(sources.status, 200);
    const list = JSON.parse(sources.body).sources;
    assert.equal(list.length, 3);
    assert.ok(list.some((s) => s.type === 'foreign_property' && s.countryCode === 'ESP'));

    const dash = await request('GET', '/api/me/dashboard');
    assert.equal(dash.status, 200);
    const d = JSON.parse(dash.body);
    assert.equal(d.sources.length, 3);
    assert.ok(d.nextTask?.href);
  });

  it('cumulative review after sample import', async () => {
    const imp = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'combined' })
    );
    assert.equal(imp.status, 200);
    const draftId = JSON.parse(imp.body).draftId;
    assert.ok(draftId);
    const rev = await request(
      'GET',
      `/api/me/drafts/${draftId}/cumulative-review`
    );
    assert.equal(rev.status, 200);
    const body = JSON.parse(rev.body);
    assert.ok(body.review?.sections?.length >= 1);
    assert.ok(
      body.review.sections.some((s) => s.source === 'self_employment')
    );
    // YTD columns present
    const row = body.review.sections[0].rows[0];
    assert.ok('thisQuarter' in row && 'yearToDate' in row);

    const snap = await request(
      'POST',
      `/api/me/drafts/${draftId}/snapshot`,
      JSON.stringify({})
    );
    assert.equal(snap.status, 200);
  });

  it('nil update creates draft with zero activity', async () => {
    const res = await request(
      'POST',
      '/api/me/nil-update',
      JSON.stringify({
        type: 'self_employment',
        taxYear: '2024-25',
        periodStartDate: '2024-04-06',
        periodEndDate: '2024-07-05',
      })
    );
    assert.equal(res.status, 201);
    const j = JSON.parse(res.body);
    assert.ok(j.draftId);
    assert.equal(j.payloads.selfEmployment.periodIncome.turnover, 0);
  });

  it('maps HMRC businesses into source types', () => {
    const mapped = mapHmrcBusinessesToSources([
      { typeOfBusiness: 'self-employment', businessId: 'A', tradingName: 'Trade' },
      { typeOfBusiness: 'uk-property', businessId: 'B' },
      { typeOfBusiness: 'foreign-property', businessId: 'C' },
    ]);
    assert.equal(mapped[0].type, 'self_employment');
    assert.equal(mapped[1].type, 'uk_property');
    assert.equal(mapped[2].type, 'foreign_property');
  });

  it('buildCumulativeReview adds previous into YTD', () => {
    const rev = buildCumulativeReview(
      {
        meta: { taxYear: '2024-25', periodStartDate: '2024-07-06', periodEndDate: '2024-10-05' },
        selfEmployment: {
          periodIncome: { turnover: 18400, other: 0 },
          periodExpenses: { travelCosts: 620 },
        },
      },
      { turnover_sales: 16200, travelcosts: 410 }
    );
    // keys are normalized from labels
    const sales = rev.sections[0].rows.find((r) => /turnover|sales/i.test(r.label));
    assert.ok(sales);
    assert.equal(sales.thisQuarter, 18400);
  });

  it('practice workflow states catalog', async () => {
    const res = await request('GET', '/api/practice/workflow-states');
    assert.equal(res.status, 200);
    const states = JSON.parse(res.body).states;
    assert.ok(states.includes('awaiting_client_approval'));
    assert.ok(states.includes('ready_to_submit'));
  });
});
