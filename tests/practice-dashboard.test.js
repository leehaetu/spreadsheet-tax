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

  it('paginates clients for large-book readiness', async () => {
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
    const res = await request(
      'GET',
      `/api/me/clients?firmId=${encodeURIComponent(firmId)}&limit=2&offset=0`
    );
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.ok, true);
    assert.ok(Array.isArray(j.clients));
    assert.ok(typeof j.total === 'number');
    assert.equal(j.limit, 2);
    assert.ok(j.clients.length <= 2);
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

  it('creates a new firm for signed-in user', async () => {
    cookie = '';
    const email = `firm-create-${Date.now()}@example.com`;
    await request(
      'POST',
      '/api/auth/register',
      JSON.stringify({
        email,
        password: 'TestPass123!',
        name: 'Firm Creator',
      })
    );
    const res = await request(
      'POST',
      '/api/me/firms',
      JSON.stringify({ name: 'Green Bookkeepers LLP' })
    );
    assert.equal(res.status, 201);
    const j = JSON.parse(res.body);
    assert.equal(j.firm.name, 'Green Bookkeepers LLP');
    assert.equal(j.role, 'practice_admin');
    const firms = JSON.parse((await request('GET', '/api/me/firms')).body);
    assert.ok(firms.firms.some((f) => f.id === j.firm.id));
  });

  it('creates and deletes a client; renames firm', async () => {
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
    const created = await request(
      'POST',
      '/api/me/clients',
      JSON.stringify({ firmId, name: 'Delete Me Ltd' })
    );
    assert.equal(created.status, 201);
    const clientId = JSON.parse(created.body).client.id;
    const del = await request('DELETE', `/api/me/clients/${clientId}`);
    assert.equal(del.status, 200);
    const ren = await request(
      'PATCH',
      `/api/me/firms/${firmId}`,
      JSON.stringify({ name: firms.firms[0].name })
    );
    assert.equal(ren.status, 200);
    assert.ok(JSON.parse(ren.body).firm?.name);
  });
});
