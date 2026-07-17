import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-portal-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'p.sqlite');
process.env.NODE_ENV = 'test';

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

describe('portal invites', () => {
  it('creates invite and resolves portal client by token', async () => {
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
    const clients = JSON.parse(
      (await request('GET', `/api/me/clients?firmId=${firmId}`)).body
    );
    const clientId = clients.clients[0].id;
    const inv = await request(
      'POST',
      `/api/me/clients/${clientId}/portal-invite`,
      '{}'
    );
    assert.equal(inv.status, 200);
    const ij = JSON.parse(inv.body);
    assert.ok(ij.token);
    cookie = '';
    const portal = await request(
      'GET',
      `/api/portal/client?token=${encodeURIComponent(ij.token)}`
    );
    assert.equal(portal.status, 200);
    const pj = JSON.parse(portal.body);
    assert.ok(pj.client.name);

    const exportRes = await request(
      'GET',
      `/api/me/clients/export?firmId=${encodeURIComponent(firmId)}`
    );
    // need cookie again after cookie cleared for portal
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const exportRes2 = await request(
      'GET',
      `/api/me/clients/export?firmId=${encodeURIComponent(firmId)}`
    );
    assert.equal(exportRes2.status, 200);
    assert.match(exportRes2.body, /client_id,name,status/);

    const patchDue = await request(
      'PATCH',
      `/api/me/clients/${clientId}`,
      JSON.stringify({ dueDate: '2026-10-05' })
    );
    assert.equal(patchDue.status, 200);
    const updated = JSON.parse(patchDue.body);
    assert.equal(updated.client.dueDate, '2026-10-05');
  });
});
