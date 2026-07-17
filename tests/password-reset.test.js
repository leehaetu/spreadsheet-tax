import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-pw-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'pw.sqlite');
process.env.EMAIL_LOG = '0';

const { default: app } = await import('../src/server.js');
const { createPasswordResetToken, findUserByEmail, verifyPassword } =
  await import('../src/lib/auth.js');

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

describe('password reset and change', () => {
  it('resets password via token and signs in with new password', async () => {
    const created = createPasswordResetToken('demo@spreadsheet-tax.example');
    assert.ok(created?.token);
    const reset = await request(
      'POST',
      '/api/auth/reset-password',
      JSON.stringify({ token: created.token, password: 'NewDemoPass99!' })
    );
    assert.equal(reset.status, 200);
    cookie = '';
    const login = await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'NewDemoPass99!',
      })
    );
    assert.equal(login.status, 200);
    // restore demo password for other tests in other files (separate DBs)
    const user = findUserByEmail('demo@spreadsheet-tax.example');
    assert.ok(verifyPassword('NewDemoPass99!', user.password_hash));
  });

  it('changes password when signed in', async () => {
    cookie = '';
    await request(
      'POST',
      '/api/auth/register',
      JSON.stringify({
        email: 'changer@example.com',
        password: 'password12',
        name: 'Changer',
      })
    );
    const res = await request(
      'POST',
      '/api/auth/change-password',
      JSON.stringify({
        currentPassword: 'password12',
        newPassword: 'password99x',
      })
    );
    assert.equal(res.status, 200);
    cookie = '';
    const login = await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'changer@example.com',
        password: 'password99x',
      })
    );
    assert.equal(login.status, 200);
  });

  it('forgot-password always returns ok', async () => {
    const res = await request(
      'POST',
      '/api/auth/forgot-password',
      JSON.stringify({ email: 'nobody@example.com' })
    );
    assert.equal(res.status, 200);
  });
});
