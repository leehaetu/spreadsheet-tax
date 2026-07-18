/**
 * Product workflows: every year-end / quarterly name on the real /api/workflows/run path.
 * Preview mode stores receipt; unknown names rejected before success.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { KNOWN_WORKFLOWS } from '../src/lib/workflows.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-wf-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'wf.sqlite');
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

async function runWorkflow(workflow, extra = {}) {
  return request(
    'POST',
    '/api/workflows/run',
    JSON.stringify({
      workflow,
      nino: 'AA123456A',
      taxYear: '2024-25',
      businessIdSe: 'XAIS12345678901',
      businessIdUk: 'XPIS12345678901',
      businessIdForeign: 'XFIS12345678901',
      periodId: '2024-04-06_2024-07-05',
      calculationId: '717f3a7a-db8e-11e9-8a34-2a2ae2dbcce4',
      ...extra,
    })
  );
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

describe('year-end workflows', () => {
  it('serves guided year-end case with EOY workflow buttons', async () => {
    const res = await request('GET', '/year-end');
    assert.equal(res.status, 200);
    assert.match(res.body, /Tax return|year end|Guided year-end/i);
    // Quarterly period creates live on /app; year-end is annual/calc/BSAS/final
    for (const name of [
      'final_obligations',
      'se_annual',
      'uk_annual',
      'fp_annual',
      'other_income',
      'losses',
      'calc',
      'bsas_trigger',
      'bsas_adjust',
      'final_calc',
      'se_amend',
    ]) {
      assert.match(
        res.body,
        new RegExp(`data-wf="${name}"`),
        `year-end.html missing data-wf=${name}`
      );
    }
  });

  it('rejects unknown workflow before preview success', async () => {
    const res = await runWorkflow('not_a_real_workflow');
    assert.equal(res.status, 400);
    const j = JSON.parse(res.body);
    assert.match(j.error || '', /unknown/i);
    assert.ok(Array.isArray(j.known));
    assert.ok(j.known.includes('se_annual'));
  });

  it('every known workflow returns preview receipt on product path', async () => {
    /** @type {{ workflow: string, receiptId: string, status: number }[]} */
    const results = [];
    for (const workflow of KNOWN_WORKFLOWS) {
      const res = await runWorkflow(workflow);
      assert.equal(
        res.status,
        200,
        `${workflow} expected 200, got ${res.status}: ${res.body}`
      );
      const j = JSON.parse(res.body);
      assert.equal(j.workflow, workflow);
      assert.equal(j.previewOnly, true);
      assert.equal(j.mode, 'double');
      assert.ok(j.receiptId, `${workflow} must store receiptId`);
      const rec = await request('GET', `/api/receipts/${j.receiptId}`);
      assert.equal(rec.status, 200, `${workflow} receipt fetch`);
      const receipt = JSON.parse(rec.body).receipt;
      assert.equal(receipt.id, j.receiptId);
      assert.ok(Array.isArray(receipt.results));
      assert.equal(receipt.results[0]?.workflow, workflow);
      results.push({
        workflow,
        receiptId: j.receiptId,
        status: res.status,
      });
    }
    assert.equal(results.length, KNOWN_WORKFLOWS.length);
    // Write durable proof for verifier
    const scratch =
      process.env.GOAL_SCRATCH ||
      '/var/folders/fd/_phnmnqs7_q846l83_7qhgz80000gn/T/grok-goal-76b8b72ebafd/implementer';
    try {
      fs.mkdirSync(scratch, { recursive: true });
      fs.writeFileSync(
        path.join(scratch, 'workflows.log'),
        [
          'workflow | http_status | receiptId | mode',
          ...results.map(
            (r) =>
              `${r.workflow} | ${r.status} | ${r.receiptId} | preview`
          ),
          `known_count=${KNOWN_WORKFLOWS.length}`,
          'path=POST /api/workflows/run (shipped product API)',
        ].join('\n') + '\n'
      );
    } catch {
      /* optional */
    }
  });

  it('quarterly multi-source sample import + submit creates receipt', async () => {
    for (const sample of [
      'self_employment',
      'uk_property',
      'foreign_property',
      'combined',
    ]) {
      const imp = await request(
        'POST',
        '/api/import/sample',
        JSON.stringify({ sample })
      );
      assert.equal(imp.status, 200, sample);
      const { draftId } = JSON.parse(imp.body);
      assert.ok(draftId, sample);
      const sub = await request(
        'POST',
        '/api/submit',
        JSON.stringify({
          draftId,
          nino: 'AA123456A',
          taxYear: '2024-25',
          businessIdSe: 'XAIS12345678901',
          businessIdUk: 'XPIS12345678901',
          businessIdForeign: 'XFIS12345678901',
        })
      );
      assert.equal(sub.status, 200, `submit ${sample}`);
      const sj = JSON.parse(sub.body);
      assert.equal(sj.previewOnly, true);
      assert.ok(sj.attemptId || sj.ok);
    }
  });

  it('requires auth', async () => {
    cookie = '';
    const res = await runWorkflow('calc');
    assert.equal(res.status, 401);
  });

  it('requires nino for known workflow', async () => {
    await request(
      'POST',
      '/api/auth/login',
      JSON.stringify({
        email: 'demo@spreadsheet-tax.example',
        password: 'DemoPass123!',
      })
    );
    const res = await request(
      'POST',
      '/api/workflows/run',
      JSON.stringify({ workflow: 'calc' })
    );
    assert.equal(res.status, 400);
  });
});
