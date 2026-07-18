/**
 * Phase 1 freeze + security foundations (CSRF, lockout, MFA, billing gate).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { totpAt, generateTotpSecret, verifyTotp } from '../src/lib/mfa-totp.js';
import { paymentsLive, productSurfacePublicStatus } from '../src/lib/product-surfaces.js';
import {
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from '../src/lib/login-lockout.js';

process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.CSRF_ENFORCE = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');

/** @type {http.Server} */
let server;
/** @type {number} */
let port;

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          ...headers,
          ...(data
            ? {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
              }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
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
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  port = /** @type {import('net').AddressInfo} */ (server.address()).port;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('Product surface freeze', () => {
  it('hides billing from customer nav when payments are not live', () => {
    assert.equal(paymentsLive({}), false);
    const status = productSurfacePublicStatus({});
    assert.equal(status.billingCustomerNav, false);
    assert.ok(status.hiddenFromCustomerNav.includes('/billing'));
    assert.ok(status.hiddenFromCustomerNav.includes('/mtd'));
  });

  it('status reports freeze and honesty flags', async () => {
    const res = await request('GET', '/api/status');
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.honesty.paymentsLive, false);
    // Full productSurfaces inventory is no longer public on /api/status
    assert.equal(json.productSurfaces, undefined);
    assert.equal(json.honesty.billingCharged, false);
  });
});

describe('Billing gate', () => {
  it('rejects select-plan without Stripe', async () => {
    const email = `freeze-${Date.now()}@example.com`;
    const reg = await request(
      'POST',
      '/api/auth/register',
      JSON.stringify({ email, password: 'TestPass123!', name: 'Freeze' })
    );
    assert.equal(reg.status, 201);
    const cookie = reg.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookie) ? cookie.map((c) => c.split(';')[0]).join('; ') : String(cookie || '').split(';')[0];
    const csrfRes = await request('GET', '/api/csrf', null, { Cookie: cookieHeader });
    const csrf = JSON.parse(csrfRes.body);
    const plan = await request(
      'POST',
      '/api/billing/select-plan',
      JSON.stringify({ planId: 'personal' }),
      {
        Cookie: cookieHeader,
        'X-CSRF-Token': csrf.csrfToken,
      }
    );
    assert.equal(plan.status, 503);
    const body = JSON.parse(plan.body);
    assert.equal(body.code, 'BILLING_NOT_LIVE');
  });
});

describe('CSRF', () => {
  it('rejects authenticated POST without CSRF when enforced', async () => {
    const email = `csrf-${Date.now()}@example.com`;
    const reg = await request(
      'POST',
      '/api/auth/register',
      JSON.stringify({ email, password: 'TestPass123!', name: 'Csrf' })
    );
    assert.equal(reg.status, 201);
    const cookie = reg.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookie)
      ? cookie.map((c) => c.split(';')[0]).join('; ')
      : String(cookie || '').split(';')[0];
    const bad = await request(
      'POST',
      '/api/auth/change-password',
      JSON.stringify({ currentPassword: 'TestPass123!', newPassword: 'TestPass999!' }),
      { Cookie: cookieHeader }
    );
    assert.equal(bad.status, 403);
    const j = JSON.parse(bad.body);
    assert.equal(j.code, 'CSRF_REJECTED');
  });
});

describe('Login lockout', () => {
  it('locks after repeated failures', () => {
    const key = `email:lockout-test-${Date.now()}@example.com`;
    clearLoginFailures(key);
    for (let i = 0; i < 8; i++) recordLoginFailure(key);
    const state = isLoginLocked(key);
    assert.equal(state.locked, true);
    clearLoginFailures(key);
    assert.equal(isLoginLocked(key).locked, false);
  });
});

describe('TOTP MFA', () => {
  it('generates and verifies codes', () => {
    const secret = generateTotpSecret();
    const code = totpAt(secret);
    assert.match(code, /^\d{6}$/);
    assert.equal(verifyTotp(secret, code), true);
    assert.equal(verifyTotp(secret, '000000'), false);
  });
});
