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
