/**
 * AC: security claims match year-end; readback only attempted when retrieve HTTP runs.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { performWorkflowReadback } from '../src/lib/workflow-readback.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-rb-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'rb.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');

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
});

after(async () => {
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});

describe('customer-facing claims alignment', () => {
  it('security.html no longer says EOY/BSAS/losses not supported', async () => {
    const res = await request('GET', '/security');
    assert.equal(res.status, 200);
    assert.doesNotMatch(
      res.body,
      /Not supported in this product stage:\s*final declaration/i
    );
    assert.doesNotMatch(
      res.body,
      /Not supported in this product stage:[\s\S]*BSAS/i
    );
    // Positive: points at year-end and quarterly (customer language)
    assert.match(res.body, /year-end|Year-end/i);
    assert.match(res.body, /quarterly/i);
    assert.match(res.body, /not.*HMRC-recognised|not.*recognised software list/i);

    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const ye = await request('GET', '/year-end');
    assert.equal(ye.status, 200);
    assert.match(ye.body, /data-wf="final_obligations"/);
    assert.match(ye.body, /data-wf="bsas_trigger"/);
    assert.match(ye.body, /data-wf="losses"/);
  });
});

describe('workflow readback honesty', () => {
  it('preview path sets readback.attempted false', async () => {
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const res = await request(
      'POST',
      '/api/workflows/run',
      JSON.stringify({
        workflow: 'se_period',
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      })
    );
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.previewOnly, true);
    assert.equal(j.readback?.attempted, false);
    assert.match(j.readback?.note || '', /preview|no HMRC/i);

    const rec = await request('GET', `/api/receipts/${j.receiptId}`);
    assert.equal(rec.status, 200);
    const receipt = JSON.parse(rec.body).receipt;
    const rb = receipt.results?.[0]?.readback;
    assert.equal(rb?.attempted, false);
  });

  it('performWorkflowReadback calls retrieveSePeriod when ids present', async () => {
    let called = false;
    const fake = {
      async retrieveSePeriod(opts) {
        called = true;
        assert.equal(opts.businessId, 'XBIS1');
        assert.equal(opts.periodId, '2024-04-06_2024-07-05');
        return {
          ok: true,
          status: 200,
          path: '/individuals/business/self-employment/x/XBIS1/period/2024-25/2024-04-06_2024-07-05',
          body: { periodDates: { periodStartDate: '2024-04-06' } },
        };
      },
      taxYearFromPeriodId: () => '2024-25',
    };
    const rb = await performWorkflowReadback(
      {
        workflow: 'se_period',
        hmrcResult: { body: { periodId: '2024-04-06_2024-07-05' } },
        o: { accessToken: 't', nino: 'AA123456A' },
        body: {
          businessIdSe: 'XBIS1',
          periodId: '2024-04-06_2024-07-05',
        },
        taxYear: '2024-25',
      },
      fake
    );
    assert.equal(called, true);
    assert.equal(rb.attempted, true);
    assert.equal(rb.ok, true);
    assert.equal(rb.hmrcStatus, 200);
    assert.equal(rb.label, 'se_period_retrieve');
  });

  it('se_annual does not claim attempted without retrieve call', async () => {
    const rb = await performWorkflowReadback({
      workflow: 'se_annual',
      hmrcResult: { status: 204, ok: true },
      o: {},
      body: { businessIdSe: 'X' },
      taxYear: '2024-25',
    });
    assert.equal(rb.attempted, false);
    assert.match(rb.note || '', /no HMRC retrieve/i);
  });

  it('bsas_trigger with calculationId retrieves BSAS', async () => {
    let called = false;
    const rb = await performWorkflowReadback(
      {
        workflow: 'bsas_trigger',
        hmrcResult: { body: { calculationId: 'calc-1' } },
        o: { nino: 'AA123456A' },
        body: {},
        taxYear: '2024-25',
      },
      {
        async retrieveBsasSelfEmployment(opts) {
          called = true;
          assert.equal(opts.calculationId, 'calc-1');
          return {
            ok: true,
            status: 200,
            path: '/bsas/calc-1',
            body: { summary: true },
          };
        },
      }
    );
    assert.equal(called, true);
    assert.equal(rb.attempted, true);
    assert.equal(rb.ok, true);
  });
});
