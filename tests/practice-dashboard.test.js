import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-dash-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'dash.sqlite');

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
            headers: res.headers,
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
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      r();
    });
  });
});

after(async () => {
  await new Promise((r) => server.close(r));
});

describe('practice dashboard and submissions export', () => {
  it('returns firm dashboard with needs-action counts', async () => {
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
    assert.ok(firms.firms?.length);
    const firmId = firms.firms[0].id;
    const res = await request(
      'GET',
      `/api/me/practice-dashboard?firmId=${encodeURIComponent(firmId)}`
    );
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.ok, true);
    assert.ok(j.dashboard);
    assert.ok(typeof j.dashboard.totalClients === 'number');
    assert.ok(typeof j.dashboard.needsActionCount === 'number');
    assert.ok(j.dashboard.byStatus);
    assert.ok(Array.isArray(j.dashboard.needsAction));
  });

  it('exports submissions CSV for signed-in user', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const res = await request('GET', '/api/me/submissions/export');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'] || '', /text\/csv/);
    assert.match(res.body, /attempt_id,draft_id,mode,ok,created_at/);
  });

  it('rejects dashboard without firm access', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const res = await request(
      'GET',
      '/api/me/practice-dashboard?firmId=not-a-real-firm'
    );
    assert.equal(res.status, 400);
  });
});
