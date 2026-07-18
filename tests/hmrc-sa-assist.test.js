/**
 * Self Assessment Assist (MTD) 1.0 — path construction + workflow registration.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSaAssistReport,
  acknowledgeSaAssistReport,
  mtdCapabilityMatrix,
} from '../src/lib/hmrc-api.js';
import { isKnownWorkflow, KNOWN_WORKFLOWS } from '../src/lib/workflows.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('Self Assessment Assist (MTD)', () => {
  it('is registered as a known workflow pair', () => {
    assert.equal(isKnownWorkflow('sa_assist_report'), true);
    assert.equal(isKnownWorkflow('sa_assist_acknowledge'), true);
    assert.ok(KNOWN_WORKFLOWS.includes('sa_assist_report'));
  });

  it('capability matrix advertises SA Assist', () => {
    const m = mtdCapabilityMatrix();
    assert.equal(m.endOfYear.saAssistReport, true);
    assert.equal(m.extras.saAssist, true);
    assert.ok(
      m.extras.hubApis.some((name) => /Self Assessment Assist/i.test(name))
    );
  });

  it('builds generate report path with nino, tax year and calculation id', async () => {
    const original = globalThis.fetch;
    /** @type {string|null} */
    let calledUrl = null;
    /** @type {string|null} */
    let method = null;
    /** @type {Record<string,string>|null} */
    let headers = null;
    globalThis.fetch = async (url, opts) => {
      calledUrl = String(url);
      method = opts?.method || 'GET';
      headers = opts?.headers || {};
      return {
        ok: true,
        status: 200,
        headers: {
          forEach(cb) {
            cb('corr-test-id', 'x-correlationid');
          },
        },
        async text() {
          return JSON.stringify({
            reportId: '579800fe-e047-cd40-b3e4-0e14b1f183a8',
            messages: [
              {
                title: 'Check something',
                body: 'Placeholder body',
                action: 'Placeholder action',
              },
            ],
          });
        },
      };
    };
    try {
      const result = await generateSaAssistReport({
        nino: 'AA123456A',
        taxYear: '2025-26',
        calculationId: 'f2fb30e5-4ab6-4a29-b3c1-c7264259ff1c',
        accessToken: 'test-token',
      });
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(result.correlationId, 'corr-test-id');
      assert.match(
        calledUrl || '',
        /\/individuals\/self-assessment\/assist\/reports\/AA123456A\/2025-26\/f2fb30e5-4ab6-4a29-b3c1-c7264259ff1c$/
      );
      assert.equal(method, 'POST');
      assert.equal(headers?.Accept, 'application/vnd.hmrc.1.0+json');
      assert.equal(result.body?.reportId, '579800fe-e047-cd40-b3e4-0e14b1f183a8');
      assert.equal(result.body?.messages?.length, 1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('builds acknowledge path with report and correlation ids', async () => {
    const original = globalThis.fetch;
    /** @type {string|null} */
    let calledUrl = null;
    globalThis.fetch = async (url, opts) => {
      calledUrl = String(url);
      return {
        ok: true,
        status: 204,
        headers: { forEach() {} },
        async text() {
          return '';
        },
      };
    };
    try {
      const result = await acknowledgeSaAssistReport({
        nino: 'AA123456A',
        reportId: '579800fe-e047-cd40-b3e4-0e14b1f183a8',
        correlationId: 'BD5A1B594995A197D528ECCF4BC6EA793C869B2F75333902F043E35561B927C4',
        accessToken: 'test-token',
      });
      assert.equal(result.ok, true);
      assert.equal(result.status, 204);
      assert.match(
        calledUrl || '',
        /\/individuals\/self-assessment\/assist\/reports\/acknowledge\/AA123456A\/579800fe-e047-cd40-b3e4-0e14b1f183a8\/BD5A1B594995A197/
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it('requires calculationId for generate and ids for acknowledge', async () => {
    await assert.rejects(
      () =>
        generateSaAssistReport({
          nino: 'AA123456A',
          taxYear: '2025-26',
          calculationId: '',
          accessToken: 't',
        }),
      /calculationId/
    );
    await assert.rejects(
      () =>
        acknowledgeSaAssistReport({
          nino: 'AA123456A',
          reportId: '',
          correlationId: 'x',
          accessToken: 't',
        }),
      /reportId/
    );
  });

  it('product surfaces Assist as a year-end customer stage (not API-only)', () => {
    const yearEnd = fs.readFileSync(path.join(root, 'public/year-end.html'), 'utf8');
    assert.match(yearEnd, /data-wf="sa_assist_report"/);
    assert.match(yearEnd, /data-wf="sa_assist_acknowledge"/);
    assert.match(yearEnd, /hmrc-assist\.js/);
    const eoy = fs.readFileSync(path.join(root, 'src/lib/eoy-case.js'), 'utf8');
    assert.match(eoy, /id: 'hmrc_assist'/);
    const app = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
    assert.match(app, /Open year-end for HMRC Assist/);
    assert.match(app, /assist-report-btn|hmrc-assist/i);
    const yeJs = fs.readFileSync(path.join(root, 'public/js/year-end.js'), 'utf8');
    assert.match(yeJs, /sa_assist_report/);
    assert.match(yeJs, /hmrc_assist/);
    assert.match(yeJs, /renderAssistResult|HmrcAssist/);
    assert.match(yeJs, /eoy-assist-host|assist-stage-panel/);
  });

  it('OAuth default scopes include assist read/write', () => {
    const oauth = fs.readFileSync(path.join(root, 'src/lib/hmrc-oauth.js'), 'utf8');
    assert.match(oauth, /read:self-assessment-assist/);
    assert.match(oauth, /write:self-assessment-assist/);
  });
});
