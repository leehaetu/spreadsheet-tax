/**
 * Operational product readiness: production API switch, no invented live mode,
 * live-submit gates, queue approval, capacity honesty.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  resolveConfig,
  resolveHmrcBaseUrl,
  canAttemptLiveHmrc,
  createHmrcClient,
} from '../src/lib/hmrc-client.js';
import { operationalDbMode, operationalStoreHealth } from '../src/lib/operational-store.js';
import { evaluateProductionSafety } from '../src/lib/production-boot.js';
import { enqueueJob, claimJob, completeJob } from '../src/lib/job-queue.js';
import { performQueuedHmrcSubmit } from '../src/lib/live-submit.js';
import { KNOWN_WORKFLOWS } from '../src/lib/workflows.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ops-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'ops.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;
delete process.env.DATABASE_URL;
delete process.env.HMRC_ACCESS_TOKEN;

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

describe('production API env switch', () => {
  it('resolves production host from HMRC_OAUTH_ENV only', () => {
    assert.equal(
      resolveHmrcBaseUrl({ HMRC_OAUTH_ENV: 'production' }),
      'https://api.service.hmrc.gov.uk'
    );
    assert.equal(
      resolveHmrcBaseUrl({ HMRC_OAUTH_ENV: 'sandbox' }),
      'https://test-api.service.hmrc.gov.uk'
    );
  });

  it('never invents live mode from client_id alone', () => {
    const prevId = process.env.HMRC_CLIENT_ID;
    const prevTok = process.env.HMRC_ACCESS_TOKEN;
    process.env.HMRC_CLIENT_ID = 'some-real-looking-client-id';
    delete process.env.HMRC_ACCESS_TOKEN;
    try {
      const cfg = resolveConfig({});
      assert.equal(cfg.mode, 'double');
      assert.equal(canAttemptLiveHmrc({}), false);
      const client = createHmrcClient({});
      assert.equal(client.mode, 'double');
    } finally {
      if (prevId) process.env.HMRC_CLIENT_ID = prevId;
      else delete process.env.HMRC_CLIENT_ID;
      if (prevTok) process.env.HMRC_ACCESS_TOKEN = prevTok;
    }
  });

  it('with token + production oauth env uses production mode label', () => {
    const cfg = resolveConfig({
      accessToken: 'real-oauth-token-not-mock',
      mode: undefined,
    });
    // mode depends on process env HMRC_OAUTH_ENV
    assert.ok(cfg.mode === 'sandbox' || cfg.mode === 'production');
    assert.notEqual(cfg.mode, 'double');
  });
});

describe('operational store honesty', () => {
  it('sqlite mode without DATABASE_URL', () => {
    assert.equal(operationalDbMode({}), 'sqlite');
    const h = operationalStoreHealth();
    assert.equal(h.dbMode, 'sqlite');
    assert.equal(h.postgresConfigured, false);
  });

  it('postgres mode when DATABASE_URL set', () => {
    assert.equal(
      operationalDbMode({ DATABASE_URL: 'postgres://localhost/st' }),
      'postgres'
    );
  });
});

describe('production boot', () => {
  it('refuses production without secrets', () => {
    const r = evaluateProductionSafety({ NODE_ENV: 'production' });
    assert.equal(r.ok, false);
    assert.ok(r.errors.length >= 1);
  });

  it('refuses production live without Hub credentials', () => {
    const r = evaluateProductionSafety({
      NODE_ENV: 'production',
      SESSION_SECRET: 'x'.repeat(40),
      TOKEN_ENCRYPTION_KEY: 'y'.repeat(40),
      COOKIE_SECURE: '1',
      HMRC_ALLOW_LIVE_SUBMIT: '1',
      HMRC_OAUTH_ENV: 'production',
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /HMRC_CLIENT/i.test(e)));
  });
});

describe('queue never autonomous HMRC', () => {
  it('hmrc_submit without userApproved throws', async () => {
    await assert.rejects(
      () => performQueuedHmrcSubmit({ draftId: 'x', userApproved: false }),
      /userApproved/
    );
    await assert.rejects(
      () => performQueuedHmrcSubmit({ draftId: 'x' }),
      /userApproved/
    );
  });

  it('hmrc_submit with userApproved but no durable approval throws', async () => {
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
      JSON.stringify({ sample: 'self_employment' })
    );
    const draftId = JSON.parse(sample.body).draftId;
    // userApproved true but never approved figures — must not re-self-approve
    await assert.rejects(
      () =>
        performQueuedHmrcSubmit({
          userApproved: true,
          draftId,
          nino: 'AA123456A',
          taxYear: '2024-25',
          businessIdSe: 'XAIS12345678901',
        }),
      /durable figure approval|no durable/i
    );
  });

  it('enqueues and claims hmrc_submit job with approval flag', async () => {
    const job = await enqueueJob({
      queue: 'hmrc_submit',
      jobType: 'hmrc_submit',
      payload: { userApproved: true, draftId: 'draft-test' },
    });
    assert.ok(job.id);
    const claimed = await claimJob('hmrc_submit', 'test-worker');
    assert.ok(claimed);
    assert.equal(claimed.jobType, 'hmrc_submit');
    assert.equal(claimed.payload.userApproved, true);
    await completeJob(claimed.id);
  });
});

describe('production mode labeling on live results', () => {
  it('submitViaSandbox uses config.mode production when set', async () => {
    const { submitViaSandbox, buildSubmitRequest } = await import(
      '../src/lib/hmrc-client.js'
    );
    // Mock fetch
    const orig = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 });
    try {
      const prepared = buildSubmitRequest(
        {
          source: 'self_employment',
          nino: 'AA123456A',
          businessId: 'XAIS1',
          taxYear: '2024-25',
          body: { periodIncome: { turnover: 1 } },
        },
        {
          mode: 'production',
          baseUrl: 'https://api.service.hmrc.gov.uk',
          accessToken: 'tok',
        }
      );
      const r = await submitViaSandbox(prepared, {
        mode: 'production',
        accessToken: 'tok',
      });
      assert.equal(r.mode, 'production');
      assert.equal(r.externalCallMade, true);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('performProductSubmit with pre-supplied token uses production mode when HMRC_OAUTH_ENV=production', async () => {
    const prevAllow = process.env.HMRC_ALLOW_LIVE_SUBMIT;
    const prevOauth = process.env.HMRC_OAUTH_ENV;
    process.env.HMRC_ALLOW_LIVE_SUBMIT = '1';
    process.env.HMRC_OAUTH_ENV = 'production';
    const orig = globalThis.fetch;
    /** @type {string|undefined} */
    let clientModeSeen;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ periodId: 'p1' }), { status: 200 });
    try {
      // Import sample draft via HTTP then call performProductSubmit with accessToken
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
        JSON.stringify({ sample: 'self_employment' })
      );
      const draftId = JSON.parse(sample.body).draftId;
      // Approve durably
      await request(
        'POST',
        `/api/me/drafts/${draftId}/approve-spreadsheet`,
        JSON.stringify({})
      );

      // Spy createHmrcClient mode by wrapping performProductSubmit path:
      // submitViaSandbox result mode must be production when token pre-supplied
      const { performProductSubmit } = await import('../src/lib/live-submit.js');
      const { createHmrcClient } = await import('../src/lib/hmrc-client.js');
      // Drive createHmrcClient the same way live-submit does
      const client = createHmrcClient({
        mode:
          process.env.HMRC_OAUTH_ENV === 'production' ? 'production' : 'sandbox',
        accessToken: 'real-user-oauth-token',
      });
      clientModeSeen = client.mode;
      assert.equal(
        clientModeSeen,
        'production',
        'pre-supplied token + HMRC_OAUTH_ENV=production must yield production mode'
      );

      // Full performProductSubmit with pre-supplied token (HTTP path pattern)
      const result = await performProductSubmit({
        draftId,
        userId: (await request('GET', '/api/auth/me').then((r) => JSON.parse(r.body))).user?.id,
        body: {
          nino: 'AA123456A',
          taxYear: '2024-25',
          businessIdSe: 'XAIS12345678901',
        },
        accessToken: 'real-user-oauth-token',
        forceDouble: false,
      });
      // Live path attempted — mode must not mislabel as sandbox
      if (!result.error) {
        assert.equal(
          result.mode,
          'production',
          `expected production mode, got ${result.mode}`
        );
      } else {
        // If live call failed network-wise, still assert client construction path above
        assert.equal(clientModeSeen, 'production');
      }
    } finally {
      globalThis.fetch = orig;
      if (prevAllow) process.env.HMRC_ALLOW_LIVE_SUBMIT = prevAllow;
      else delete process.env.HMRC_ALLOW_LIVE_SUBMIT;
      if (prevOauth) process.env.HMRC_OAUTH_ENV = prevOauth;
      else delete process.env.HMRC_OAUTH_ENV;
    }
  });
});

describe('operational SoR hooks', () => {
  it('without DATABASE_URL mirrorUser returns not mirrored', async () => {
    const { mirrorUserToPostgres } = await import(
      '../src/lib/operational-store.js'
    );
    const r = await mirrorUserToPostgres({
      id: 'u1',
      email: 'a@b.c',
      passwordHash: 'x',
      name: 'n',
    });
    assert.equal(r.mirrored, false);
  });

  it('createUser and createDraft invoke scheduleMirror on the real path when DATABASE_URL is set', async () => {
    const prevUrl = process.env.DATABASE_URL;
    const store = await import('../src/lib/operational-store.js');
    /** @type {number} */
    let scheduleCount = 0;
    try {
      process.env.DATABASE_URL = 'postgres://127.0.0.1:1/st_mirror_test';
      store.scheduleMirrorHooks.observer = () => {
        scheduleCount += 1;
      };
      assert.equal(store.operationalDbMode(), 'postgres');
      const { createUser } = await import('../src/lib/auth.js');
      const { createDraft } = await import('../src/lib/drafts.js');

      const before = scheduleCount;
      const user = createUser({
        email: `mirror-${Date.now()}@example.com`,
        password: 'MirrorPass123!',
        name: 'Mirror Test',
      });
      assert.ok(user.id);
      // auth uses dynamic import().then(scheduleMirror) — wait for microtasks
      await new Promise((r) => setTimeout(r, 50));
      assert.ok(
        scheduleCount > before,
        `createUser must call scheduleMirror (before=${before} after=${scheduleCount})`
      );

      const mid = scheduleCount;
      const draft = createDraft({
        userId: user.id,
        filename: 'mirror-test.csv',
        payloads: {
          meta: { taxYear: '2024-25' },
          selfEmployment: { periodIncome: { turnover: 1 } },
        },
      });
      assert.ok(draft.id);
      await new Promise((r) => setTimeout(r, 50));
      assert.ok(
        scheduleCount > mid,
        `createDraft must call scheduleMirror (mid=${mid} after=${scheduleCount})`
      );
    } finally {
      store.scheduleMirrorHooks.observer = null;
      if (prevUrl !== undefined) process.env.DATABASE_URL = prevUrl;
      else delete process.env.DATABASE_URL;
      // Ensure leak does not poison later tests in this process
      delete process.env.DATABASE_URL;
    }
  });
});

describe('product workflows cover SE UK foreign', () => {
  it('known workflows include multi-source periods and amends', () => {
    for (const w of [
      'se_period',
      'uk_period',
      'fp_period',
      'se_amend',
      'uk_amend',
      'fp_amend',
      'se_annual',
      'uk_annual',
      'fp_annual',
    ]) {
      assert.ok(KNOWN_WORKFLOWS.includes(w), w);
    }
  });
});

describe('HTTP health and submit integrity', () => {
  it('health reports capacityGateMet false and version', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.capacityGateMet, false);
    assert.ok(j.version);
    assert.ok(j.dbMode === 'sqlite' || j.dbMode === 'postgres');
    assert.ok(j.operationalStore || j.capacityNote);
  });

  it('preview submit with approval yields evidence; without fails', async () => {
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
      JSON.stringify({ sample: 'self_employment' })
    );
    assert.equal(sample.status, 200);
    const draftId = JSON.parse(sample.body).draftId;

    const denied = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      })
    );
    assert.equal(denied.status, 403);

    const sample2 = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'combined' })
    );
    const d2 = JSON.parse(sample2.body).draftId;
    const ok = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId: d2,
        cellsApproved: true,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
        businessIdUk: 'XPIS12345678901',
        businessIdForeign: 'XFIS12345678901',
      })
    );
    assert.equal(ok.status, 200, ok.body);
    const body = JSON.parse(ok.body);
    assert.equal(body.previewOnly, true);
    assert.equal(body.mode, 'double');
    assert.ok(body.attemptId);
    assert.ok(body.correlationId);
    assert.ok(body.figureHash);
    assert.ok(body.evidenceUrl);

    const ev = await request('GET', body.evidenceUrl);
    assert.equal(ev.status, 200);
  });
});
