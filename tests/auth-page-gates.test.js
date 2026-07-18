/**
 * Product pages must not render a usable shell when signed out (audit P0).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-gates-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'gates.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');

/** @type {http.Server} */
let server;
/** @type {number} */
let port;
let cookie = '';

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body != null ? Buffer.from(body) : null;
    /** @type {Record<string, string|number>} */
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
        if (sc) {
          cookie = sc.map((c) => c.split(';')[0]).join('; ');
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
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
  port = /** @type {import('net').AddressInfo} */ (server.address()).port;
});

after(async () => {
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});

const PROTECTED = [
  '/home',
  '/app',
  '/onboarding',
  '/records',
  '/year-end',
  '/workspace',
  '/connect-hmrc',
  '/account',
  '/history',
  '/billing',
  '/admin',
  '/mtd',
];

describe('auth page gates (audit P0)', () => {
  it('redirects protected product routes to sign-in when signed out', async () => {
    cookie = '';
    for (const p of PROTECTED) {
      const res = await request('GET', p);
      assert.equal(res.status, 302, p);
      const loc = String(res.headers.location || '');
      assert.match(loc, /\/signin/, `${p} → ${loc}`);
      assert.match(loc, /next=/, `${p} should preserve next=`);
    }
  });

  it('serves product home after real login', async () => {
    cookie = '';
    const login = await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    assert.equal(login.status, 200, login.body);
    const home = await request('GET', '/home');
    assert.equal(home.status, 200);
    assert.match(home.body, /next task|Income sources|Your tax/i);
    assert.doesNotMatch(home.body, /demo@spreadsheet-tax\.example/);
  });

  it('sign-in page does not publish demo credentials', async () => {
    cookie = '';
    const res = await request('GET', '/signin');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.body, /DemoPass123/);
    assert.doesNotMatch(res.body, /demo@spreadsheet-tax\.example/);
  });

  it('pricing does not claim live card purchase', async () => {
    const res = await request('GET', '/pricing');
    assert.equal(res.status, 200);
    assert.match(res.body, /No card payments are live|not live yet|Not sold yet/i);
    assert.doesNotMatch(res.body, /Buy now|Add to cart|Pay with card/i);
    assert.match(res.body, /Create free account|register/i);
  });
});
