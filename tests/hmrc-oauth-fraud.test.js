import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-oauth-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'o.sqlite');
process.env.HMRC_OAUTH_MOCK = '1';
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');
const { buildFraudPreventionHeaders } = await import(
  '../src/lib/fraud-headers.js'
);
const { buildSubmitRequest } = await import('../src/lib/hmrc-client.js');

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
            headers: res.headers,
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

describe('fraud prevention headers', () => {
  it('sends only honest WEB_APP fields — never invents public port', async () => {
    const { buildFraudPreventionHeadersDetailed } = await import(
      '../src/lib/fraud-headers.js'
    );
    const { headers: h, omitted } = buildFraudPreventionHeadersDetailed(
      {
        headers: {
          'user-agent': 'TestBrowser/1.0',
          'x-client-timezone-offset': '60',
          'x-client-window-size': '1280x800',
          'x-client-screens': '1920x1080',
          'x-client-screen-scale': '2',
          'x-client-screen-depth': '24',
          'x-client-device-id': '11111111-2222-4333-a444-555555555555',
        },
        socket: { remoteAddress: '203.0.113.10' },
      },
      { userId: 'user-abc' }
    );
    assert.equal(h['Gov-Client-Connection-Method'], 'WEB_APP_VIA_SERVER');
    assert.equal(h['Gov-Client-Public-IP'], '203.0.113.10');
    assert.equal(h['Gov-Client-Device-ID'], '11111111-2222-4333-a444-555555555555');
    assert.equal(h['Gov-Client-Timezone'], 'UTC+01:00');
    assert.match(h['Gov-Client-Window-Size'], /width=1280/);
    assert.match(h['Gov-Client-User-IDs'], /user-abc/);
    // Must NOT invent public port
    assert.equal(h['Gov-Client-Public-Port'], undefined);
    assert.ok(
      omitted.some((o) => o.header === 'Gov-Client-Public-Port'),
      'public port omitted with reason'
    );
    // Must NOT invent vendor IP when env not set
    assert.equal(h['Gov-Vendor-Public-IP'], undefined);

    const req = buildSubmitRequest(
      {
        source: 'self_employment',
        nino: 'AA123456A',
        businessId: 'XAIS1',
        taxYear: '2024-25',
        body: {},
      },
      {
        mode: 'double',
        req: {
          headers: {
            'user-agent': 'X',
            'x-client-device-id': '11111111-2222-4333-a444-555555555555',
          },
          socket: { remoteAddress: '203.0.113.10' },
        },
      }
    );
    assert.ok(req.headers['Gov-Client-Connection-Method']);
    assert.ok(req.headers['Gov-Client-Device-ID']);
    assert.equal(req.headers['Gov-Client-Public-Port'], undefined);
  });
});

describe('HMRC OAuth mock connect', () => {
  it('connects demo user via mock OAuth callback', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const start = await request('GET', '/api/hmrc/connect');
    assert.equal(start.status, 200);
    const sj = JSON.parse(start.body);
    assert.ok(sj.url.includes('state='));
    const u = new URL(sj.url, 'http://127.0.0.1');
    const cb = await request(
      'GET',
      `/api/hmrc/callback?code=mock-auth-code&state=${u.searchParams.get('state')}`
    );
    assert.ok([302, 301].includes(cb.status) || cb.status === 200);
    const st = await request('GET', '/api/hmrc/status');
    const stj = JSON.parse(st.body);
    // Mock connect stores a token but must not claim real HMRC connection
    assert.equal(stj.connection?.mock, true);
    assert.equal(stj.connection?.connected, false);
    assert.ok(stj.connection?.mode);
    assert.equal(stj.oauth?.mock, true);
  });
});

describe('billing plans API', () => {
  it('lists plans and freezes select-plan without Stripe', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const plans = await request('GET', '/api/plans');
    assert.equal(plans.status, 200);
    const pj = JSON.parse(plans.body);
    assert.equal(pj.paymentsLive, false);
    assert.ok(Array.isArray(pj.plans) && pj.plans.length > 0);
    const sel = await request(
      'POST',
      '/api/billing/select-plan',
      JSON.stringify({ planId: 'personal' })
    );
    // No STRIPE_SECRET_KEY → honest 503, not a fake paid plan change
    assert.equal(sel.status, 503);
    const body = JSON.parse(sel.body);
    assert.equal(body.code, 'BILLING_NOT_LIVE');
  });
});
