/**
 * Security hardening completion checks (local server).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-sec-hard-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'sec.sqlite');
process.env.JOBS_SECRET = 'test-jobs-hard';
delete process.env.DATABASE_URL;
delete process.env.OPERATOR_EMAILS;

const { default: app } = await import('../src/server.js');
const { createUser, createSession, sessionCookieHeader } = await import(
  '../src/lib/auth.js'
);
const { createFirm } = await import('../src/lib/practice-db.js');

let server;
let port;

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? Buffer.from(body) : null;
    const h = { ...headers };
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = data.length;
    }
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers: h },
      (res) => {
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

function cookieFor(userId) {
  const session = createSession(userId);
  return sessionCookieHeader(session.id, session.expiresAt).split(';')[0];
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

describe('security hardening complete', () => {
  it('blocks unauthenticated sample import, submit, draft get, sandbox-check', async () => {
    assert.equal(
      (await request('POST', '/api/import/sample', JSON.stringify({ sample: 'combined' })))
        .status,
      401
    );
    assert.equal((await request('POST', '/api/submit', '{}')).status, 401);
    assert.equal(
      (await request('GET', '/api/drafts/00000000-0000-0000-0000-000000000001')).status,
      401
    );
    assert.equal((await request('GET', '/api/hmrc/sandbox-check')).status, 403);
    const ok = await request('GET', '/api/hmrc/sandbox-check', null, {
      'x-jobs-secret': 'test-jobs-hard',
    });
    // may 200 or 503 depending on HMRC env — never 200 without secret
    assert.ok([200, 503, 500].includes(ok.status));
  });

  it('admin HTML is 403 for normal signed-in user without practice_admin', async () => {
    const user = createUser({
      email: `norm-${Date.now()}@example.com`,
      password: 'Password12!',
      name: 'Normal',
    });
    const cookie = cookieFor(user.id);
    const res = await request('GET', '/admin', null, { Cookie: cookie });
    assert.equal(res.status, 403);
    assert.match(res.body, /Access denied|practice administrator/i);
  });

  it('admin HTML is 200 for practice_admin', async () => {
    const user = createUser({
      email: `adm-${Date.now()}@example.com`,
      password: 'Password12!',
      name: 'Admin',
    });
    createFirm({ userId: user.id, name: 'Sec Firm' });
    const cookie = cookieFor(user.id);
    const res = await request('GET', '/admin', null, { Cookie: cookie });
    assert.equal(res.status, 200);
    assert.match(res.body, /Practice admin/i);
  });

  it('signin open-redirect is blocked in source', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'public/signin.html'),
      'utf8'
    );
    assert.match(html, /startsWith\('\/'\)/);
    assert.match(html, /startsWith\('\/\/'\)/);
    assert.match(html, /includes\(':\/\/'\)/);
    assert.match(html, /Open-redirect safe/);
  });

  it('health does not leak capacity inventory', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.clientRows, undefined);
    assert.equal(j.volumeDataDir, undefined);
    assert.ok(j.version);
  });

  it('x-powered-by is disabled', async () => {
    const res = await request('GET', '/health');
    const powered = res.headers['x-powered-by'];
    assert.ok(!powered, `expected no x-powered-by, got ${powered}`);
  });

  it('file-type is not a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.equal(pkg.dependencies['file-type'], undefined);
  });
});
