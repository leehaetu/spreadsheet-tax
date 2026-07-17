import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-pref-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'pr.sqlite');

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

describe('preferences and draft delete', () => {
  it('saves notification preferences', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const put = await request(
      'PUT',
      '/api/me/preferences',
      JSON.stringify({ emailReminders: false, emailProduct: true })
    );
    assert.equal(put.status, 200);
    const get = await request('GET', '/api/me/preferences');
    const gj = JSON.parse(get.body);
    assert.equal(gj.preferences.emailReminders, false);
    assert.equal(gj.preferences.emailProduct, true);
  });

  it('deletes a draft owned by the user', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const sample = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'hairdresser' })
    );
    const draftId = JSON.parse(sample.body).draftId;
    assert.ok(draftId);
    const ren = await request(
      'PATCH',
      `/api/drafts/${draftId}`,
      JSON.stringify({ filename: 'renamed-period.csv' })
    );
    assert.equal(ren.status, 200);
    assert.equal(JSON.parse(ren.body).draft.filename, 'renamed-period.csv');
    const del = await request('DELETE', `/api/drafts/${draftId}`);
    assert.equal(del.status, 200);
    const get = await request('GET', `/api/drafts/${draftId}`);
    assert.equal(get.status, 404);
  });
});

