import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-firm-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'f.sqlite');
process.env.EMAIL_LOG = '0';

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

describe('firm invites', () => {
  it('creates invite and accepts with matching email', async () => {
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
    const inv = await request(
      'POST',
      `/api/me/firms/${firmId}/invites`,
      JSON.stringify({ email: 'newhire@example.com', role: 'bookkeeper' })
    );
    assert.equal(inv.status, 201);
    const token = JSON.parse(inv.body).token;
    cookie = '';
    await request(
      'POST',
      '/api/auth/register',
      JSON.stringify({
        email: 'newhire@example.com',
        password: 'password12',
        name: 'New Hire',
      })
    );
    const accept = await request(
      'POST',
      '/api/me/firm-invites/accept',
      JSON.stringify({ token })
    );
    assert.equal(accept.status, 200);
    const me = JSON.parse((await request('GET', '/api/auth/me')).body);
    assert.ok(me.memberships.some((m) => m.firmId === firmId));
  });
});
