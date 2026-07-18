/**
 * RBAC / ABAC / tenant / rate-limit unit evidence.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-sec-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'sec.sqlite');
delete process.env.DATABASE_URL;

const { ROLE_MATRIX, roleHasPermission, PERMISSIONS, rolesWithPermission } =
  await import('../src/lib/rbac.js');
const { evaluateAbac } = await import('../src/lib/abac.js');
const {
  assertClientFirmId,
  firmIdSetForUser,
  listClientsForTenant,
} = await import('../src/lib/tenant-context.js');
const { checkRateLimit, RATE_TIERS } = await import('../src/lib/rate-limit.js');
const { authorize, assertFirmPermission } = await import(
  '../src/lib/access-control.js'
);
const { default: app } = await import('../src/server.js');
const { createUser, newId } = await import('../src/lib/auth.js');
const { getDb } = await import('../src/lib/db.js');

let server;
let port;

function request(method, urlPath, body, cookie = '') {
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
        const setCookie = res.headers['set-cookie'];
        let nextCookie = cookie;
        if (setCookie) {
          nextCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            cookie: nextCookie,
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
  port = server.address().port;
});

after(async () => {
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});

describe('RBAC matrix', () => {
  it('practice_admin can invite; bookkeeper cannot', () => {
    assert.equal(roleHasPermission('practice_admin', PERMISSIONS.FIRM_INVITE), true);
    assert.equal(roleHasPermission('bookkeeper', PERMISSIONS.FIRM_INVITE), false);
    assert.equal(roleHasPermission('bookkeeper', PERMISSIONS.CLIENT_WRITE), true);
    assert.equal(roleHasPermission('accountant', PERMISSIONS.JOB_ENQUEUE), true);
    assert.ok(rolesWithPermission(PERMISSIONS.FIRM_INVITE).includes('practice_admin'));
    assert.ok(ROLE_MATRIX.practice_admin.size >= 10);
  });
});

describe('ABAC', () => {
  it('denies unauthenticated and wrong owner draft', () => {
    const noUser = evaluateAbac(null, { type: 'draft', userId: 'a' }, {
      action: PERMISSIONS.DRAFT_READ,
    });
    assert.equal(noUser.allow, false);

    const steal = evaluateAbac(
      { id: 'b' },
      { type: 'draft', userId: 'a', firmId: null },
      { action: PERMISSIONS.DRAFT_READ }
    );
    assert.equal(steal.allow, false);
    assert.equal(steal.code, 'NOT_OWNER');
  });

  it('blocks dual-control self-submit when required', () => {
    const admin = createUser({
      email: `dual-${Date.now()}@example.com`,
      password: 'password12',
      name: 'Dual',
    });
    const firmId = newId();
    const now = new Date().toISOString();
    getDb()
      .prepare(`INSERT INTO firms (id, name, type, created_at) VALUES (?, ?, 'practice', ?)`)
      .run(firmId, 'Dual Firm', now);
    getDb()
      .prepare(
        `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, 'practice_admin')`
      )
      .run(newId(), firmId, admin.id);

    const deny = evaluateAbac(
      { id: admin.id },
      {
        type: 'draft',
        firmId,
        userId: admin.id,
        preparerUserId: admin.id,
      },
      { action: PERMISSIONS.DRAFT_SUBMIT, dualControlRequired: true }
    );
    assert.equal(deny.allow, false);
    assert.equal(deny.code, 'DUAL_CONTROL');
  });
});

describe('tenant firm id guard', () => {
  it('rejects foreign firmId and allows membership firm', () => {
    const u = createUser({
      email: `tenant-${Date.now()}@example.com`,
      password: 'password12',
      name: 'T',
    });
    const firmId = newId();
    const now = new Date().toISOString();
    getDb()
      .prepare(`INSERT INTO firms (id, name, type, created_at) VALUES (?, ?, 'practice', ?)`)
      .run(firmId, 'My Firm', now);
    getDb()
      .prepare(
        `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, 'accountant')`
      )
      .run(newId(), firmId, u.id);

    assert.equal(assertClientFirmId(u.id, firmId).ok, true);
    assert.equal(assertClientFirmId(u.id, newId()).ok, false);
    assert.ok(firmIdSetForUser(u.id).has(firmId));

    getDb()
      .prepare(
        `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
         VALUES (?, ?, 'C1', 'awaiting_records', NULL, NULL, 0, ?, ?)`
      )
      .run(newId(), firmId, now, now);
    const list = listClientsForTenant(u.id, firmId, { limit: 10 });
    assert.equal(list.clients.length, 1);
    const leak = listClientsForTenant(u.id, newId());
    assert.ok(leak.error);
  });
});

describe('rate limit', () => {
  it('trips after max hits in window', async () => {
    const key = `test-rl-${Date.now()}`;
    assert.equal(await checkRateLimit(key, 3, 60_000), true);
    assert.equal(await checkRateLimit(key, 3, 60_000), true);
    assert.equal(await checkRateLimit(key, 3, 60_000), true);
    assert.equal(await checkRateLimit(key, 3, 60_000), false);
    assert.ok(RATE_TIERS.api_global_ip.max > 0);
  });
});

describe('HTTP security posture', () => {
  it('exposes security posture without secrets', async () => {
    const res = await request('GET', '/api/security/posture');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.tenantIsolation.appLayer, true);
    assert.equal(j.rbac.roles.includes('practice_admin'), true);
    assert.equal(j.rateLimiting.globalApiMiddleware, true);
    assert.ok(j.capacity);
  });

  it('status includes security block', async () => {
    const res = await request('GET', '/api/status');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.security.rbac, true);
    assert.equal(j.security.tenantIsolation, true);
  });

  it('authorize helper denies outsider firm permission', () => {
    const outsider = createUser({
      email: `out-${Date.now()}@example.com`,
      password: 'password12',
      name: 'Out',
    });
    const denied = assertFirmPermission(outsider.id, newId(), PERMISSIONS.FIRM_READ);
    assert.ok(denied);
    assert.equal(denied.status, 403);
  });
});
