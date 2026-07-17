import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-seo-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 's.sqlite');

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

describe('seo and security discovery', () => {
  it('serves robots.txt and sitemap', async () => {
    const robots = await request('GET', '/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.body, /Disallow: \/api\//);
    const map = await request('GET', '/sitemap.xml');
    assert.equal(map.status, 200);
    assert.match(map.body, /self-employed/);
  });

  it('serves security.txt', async () => {
    const res = await request('GET', '/.well-known/security.txt');
    assert.equal(res.status, 200);
    assert.match(res.body, /Contact:/);
  });

  it('health includes version and db', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.ok, true);
    assert.ok(j.version);
    assert.equal(j.db, true);
  });

  it('readyz is ready when db is up', async () => {
    const res = await request('GET', '/readyz');
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).ready, true);
  });

  it('sets X-App-Version header', async () => {
    const res = await request('GET', '/health');
    assert.match(res.headers['x-app-version'] || '', /1\./);
  });
});

describe('audit API', () => {
  it('lists firm audit events for member', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const firms = JSON.parse((await request('GET', '/api/me/firms')).body);
    const firmId = firms.firms[0].id;
    // generate an audit event
    await request(
      'POST',
      `/api/me/firms/${firmId}/invites`,
      JSON.stringify({ email: 'audit-test@example.com', role: 'accountant' })
    );
    const audit = await request(
      'GET',
      `/api/me/audit?firmId=${encodeURIComponent(firmId)}`
    );
    assert.equal(audit.status, 200);
    const aj = JSON.parse(audit.body);
    assert.ok(Array.isArray(aj.events));
    assert.ok(aj.events.some((e) => e.action === 'firm_invite_created'));
  });
});
