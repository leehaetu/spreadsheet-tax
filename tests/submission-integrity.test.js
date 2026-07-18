/**
 * Server-enforced approval + evidence chain.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { figureHash } from '../src/lib/submission-integrity.js';
import { KNOWN_WORKFLOWS } from '../src/lib/workflows.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-integrity-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'integrity.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

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
  await request(
    'POST',
    '/api/auth/login',
    JSON.stringify({
      email: 'demo@spreadsheet-tax.example',
      password: 'DemoPass123!',
    })
  );
});

after(async () => {
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});

describe('submission integrity', () => {
  it('figureHash is stable for same payloads', () => {
    const p = { selfEmployment: { periodIncome: { turnover: 100 } } };
    assert.equal(figureHash(p), figureHash(p));
    assert.notEqual(
      figureHash(p),
      figureHash({ selfEmployment: { periodIncome: { turnover: 101 } } })
    );
  });

  it('rejects submit without approval', async () => {
    const sample = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' })
    );
    const draftId = JSON.parse(sample.body).draftId;
    const res = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      })
    );
    assert.equal(res.status, 403);
    const j = JSON.parse(res.body);
    assert.equal(j.code, 'APPROVAL_REQUIRED');
  });

  it('accepts cellsApproved and stores evidence pack', async () => {
    const sample = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' })
    );
    const draftId = JSON.parse(sample.body).draftId;
    const res = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId,
        cellsApproved: true,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      })
    );
    assert.equal(res.status, 200, res.body);
    const j = JSON.parse(res.body);
    assert.equal(j.ok, true);
    assert.ok(j.attemptId);
    assert.ok(j.correlationId);
    assert.ok(j.figureHash);
    assert.ok(j.evidenceUrl);

    const ev = await request('GET', j.evidenceUrl);
    assert.equal(ev.status, 200);
    const pack = JSON.parse(ev.body);
    assert.equal(pack.ok, true);
    assert.ok(pack.evidence);
    assert.ok(
      pack.evidence.correlationId === j.correlationId ||
        pack.evidence.evidence?.correlationId === j.correlationId ||
        pack.evidence.id === j.attemptId
    );
  });

  it('approve-spreadsheet endpoint locks figure hash', async () => {
    const sample = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' })
    );
    const draftId = JSON.parse(sample.body).draftId;
    const ap = await request(
      'POST',
      `/api/me/drafts/${draftId}/approve-spreadsheet`,
      JSON.stringify({})
    );
    assert.equal(ap.status, 200, ap.body);
    const aj = JSON.parse(ap.body);
    assert.ok(aj.figureHash);
    const res = await request(
      'POST',
      '/api/submit',
      JSON.stringify({
        draftId,
        nino: 'AA123456A',
        taxYear: '2024-25',
        businessIdSe: 'XAIS12345678901',
      })
    );
    assert.equal(res.status, 200, res.body);
  });

  it('includes UK/FP amend and multi-source BSAS in known workflows', () => {
    assert.ok(KNOWN_WORKFLOWS.includes('uk_amend'));
    assert.ok(KNOWN_WORKFLOWS.includes('fp_amend'));
    assert.ok(KNOWN_WORKFLOWS.includes('bsas_adjust_uk'));
    assert.ok(KNOWN_WORKFLOWS.includes('bsas_adjust_fp'));
    assert.ok(KNOWN_WORKFLOWS.includes('periods_of_account'));
  });

  it('preview workflows for new amend names succeed', async () => {
    for (const workflow of ['uk_amend', 'fp_amend', 'bsas_adjust_uk', 'periods_of_account']) {
      const res = await request(
        'POST',
        '/api/workflows/run',
        JSON.stringify({
          workflow,
          nino: 'AA123456A',
          taxYear: '2024-25',
          businessIdUk: 'XPIS12345678901',
          businessIdForeign: 'XFIS12345678901',
          businessIdSe: 'XAIS12345678901',
          periodId: '2024-04-06_2024-07-05',
          calculationId: '717f3a7a-db8e-11e9-8a34-2a2ae2dbcce4',
          businessId: 'XAIS12345678901',
        })
      );
      assert.equal(res.status, 200, `${workflow}: ${res.body}`);
      const j = JSON.parse(res.body);
      assert.equal(j.workflow, workflow);
      assert.equal(j.previewOnly, true);
    }
  });

  it('hmrc service status endpoint responds', async () => {
    const res = await request('GET', '/api/hmrc/service-status');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.ok(j.govUk);
  });
});
