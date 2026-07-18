/**
 * Tenant isolation + role enforcement (Gate 0 security).
 * Real HTTP against Express app + SQLite — no mocks of access control.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-iso-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'iso.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;
delete process.env.ALLOW_CLIENT_PAYLOAD_SUBMIT;

const { default: app } = await import('../src/server.js');
const { createUser, createSession } = await import('../src/lib/auth.js');
const { createFirm, createFirmInvite } = await import('../src/lib/practice-db.js');
const { getDb } = await import('../src/lib/db.js');
const { newId } = await import('../src/lib/auth.js');

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

async function register(email, password, name) {
  let cookie = '';
  const res = await request(
    'POST',
    '/api/auth/register',
    JSON.stringify({ email, password, name }),
    cookie
  );
  return res;
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('tenant isolation', () => {
  it('denies submit of another user draftId', async () => {
    const a = await register('owner-a@example.com', 'password12', 'A');
    assert.equal(a.status, 201);
    const cookieA = a.cookie;

    const imp = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' }),
      cookieA
    );
    assert.equal(imp.status, 200);
    const draftId = JSON.parse(imp.body).draftId;
    assert.ok(draftId);

    const b = await register('attacker-b@example.com', 'password12', 'B');
    assert.equal(b.status, 201);
    const cookieB = b.cookie;

    const steal = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId,
        cellsApproved: true,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      }),
      cookieB
    );
    assert.equal(steal.status, 403);
    assert.match(steal.body, /not allowed|draft/i);

    const view = await request('GET', `/api/drafts/${draftId}`, null, cookieB);
    assert.equal(view.status, 403);
  });

  it('scopes idempotency keys to user', async () => {
    const a = await register('idem-a@example.com', 'password12', 'A');
    const cookieA = a.cookie;
    const imp = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' }),
      cookieA
    );
    const draftId = JSON.parse(imp.body).draftId;
    const key = `shared-key-${Date.now()}`;
    const first = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId,
        cellsApproved: true,
        idempotencyKey: key,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      }),
      cookieA
    );
    assert.equal(first.status, 200);
    const firstJson = JSON.parse(first.body);
    assert.equal(firstJson.idempotentReplay, undefined);

    const b = await register('idem-b@example.com', 'password12', 'B');
    const impB = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' }),
      b.cookie
    );
    const draftB = JSON.parse(impB.body).draftId;
    const second = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId: draftB,
        cellsApproved: true,
        idempotencyKey: key,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      }),
      b.cookie
    );
    assert.equal(second.status, 200);
    const secondJson = JSON.parse(second.body);
    // Must not replay user A's response
    assert.notEqual(secondJson.draftId, firstJson.draftId);
    assert.notEqual(secondJson.idempotentReplay, true);
  });

  it('bookkeeper cannot invite or delete client; admin can invite', async () => {
    const adminReg = await register('admin-firm@example.com', 'password12', 'Admin');
    const adminCookie = adminReg.cookie;
    // create firm via API
    const firmRes = await request(
      'POST',
      '/api/me/firms',
      JSON.stringify({ name: 'Isolation LLP' }),
      adminCookie
    );
    assert.equal(firmRes.status, 201);
    const firmId = JSON.parse(firmRes.body).firm.id;

    // Add bookkeeper membership directly
    const bookie = createUser({
      email: 'bookie@example.com',
      password: 'password12',
      name: 'Bookie',
    });
    getDb()
      .prepare(
        `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, ?)`
      )
      .run(newId(), firmId, bookie.id, 'bookkeeper');

    // Login bookkeeper
    const loginB = await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({ email: 'bookie@example.com', password: 'password12' })
    );
    assert.equal(loginB.status, 200);
    const bookieCookie = loginB.cookie;

    const inviteDenied = await request(
      'POST',
      `/api/me/firms/${firmId}/invites`,
      JSON.stringify({ email: 'new@example.com', role: 'accountant' }),
      bookieCookie
    );
    assert.equal(inviteDenied.status, 403);

    // Admin creates client then bookkeeper cannot delete
    const clientId = newId();
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'awaiting_records', ?, ?, 0, ?, ?)`
      )
      .run(clientId, firmId, 'Client X', bookie.id, '2026-08-01', now, now);

    const delDenied = await request(
      'DELETE',
      `/api/me/clients/${clientId}`,
      null,
      bookieCookie
    );
    assert.equal(delDenied.status, 403);

    const inviteOk = await request(
      'POST',
      `/api/me/firms/${firmId}/invites`,
      JSON.stringify({ email: 'partner@example.com', role: 'accountant' }),
      adminCookie
    );
    assert.ok(inviteOk.status === 200 || inviteOk.status === 201);
  });

  it('deadline reminders require firm scope and do not scan other firms', async () => {
    const a = await register('remind-a@example.com', 'password12', 'RA');
    const firmA = await request(
      'POST',
      '/api/me/firms',
      JSON.stringify({ name: 'Firm A Rem' }),
      a.cookie
    );
    const firmAId = JSON.parse(firmA.body).firm.id;

    const b = await register('remind-b@example.com', 'password12', 'RB');
    const firmB = await request(
      'POST',
      '/api/me/firms',
      JSON.stringify({ name: 'Firm B Rem' }),
      b.cookie
    );
    const firmBId = JSON.parse(firmB.body).firm.id;

    const now = new Date().toISOString();
    const due = '2099-01-01';
    // client only on firm B
    getDb()
      .prepare(
        `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
         VALUES (?, ?, 'Other Firm Client', 'awaiting_records', ?, ?, 0, ?, ?)`
      )
      .run(newId(), firmBId, JSON.parse(b.body).user?.id || null, due, now, now);

    // Assign email on firm B owner for reminder target
    // User B is assignee - ensure assignee has email (already from register)

    // User A runs reminders for firm A — must not include firm B clients
    const run = await request(
      'POST',
      '/api/me/jobs/deadline-reminders',
      JSON.stringify({ firmId: firmAId, withinDays: 36500 }),
      a.cookie
    );
    assert.equal(run.status, 200);
    const result = JSON.parse(run.body);
    assert.equal(result.count, 0);
    // Ensure no leak of firm B client id in response
    assert.ok(!JSON.stringify(result).includes(firmBId) || result.count === 0);
  });
});

describe('production boot safety', () => {
  it('evaluateProductionSafety fails without secrets', async () => {
    const { evaluateProductionSafety } = await import(
      '../src/lib/production-boot.js'
    );
    const bad = evaluateProductionSafety({
      NODE_ENV: 'production',
      SESSION_SECRET: 'short',
      COOKIE_SECURE: '0',
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.length >= 2);

    const good = evaluateProductionSafety({
      NODE_ENV: 'production',
      SESSION_SECRET: 'x'.repeat(40),
      TOKEN_ENCRYPTION_KEY: 'y'.repeat(40),
      COOKIE_SECURE: '1',
    });
    assert.equal(good.ok, true);
  });

  it('non-production allows boot without production secrets', async () => {
    const { evaluateProductionSafety } = await import(
      '../src/lib/production-boot.js'
    );
    const r = evaluateProductionSafety({ NODE_ENV: 'test' });
    assert.equal(r.ok, true);
  });
});
