/**
 * COMPLETION-PLAN sales exit S1–S6 structural evidence.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
const { default: app } = await import('../src/server.js');

let server;
let port;

function request(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: urlPath }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        );
      })
      .on('error', reject);
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

const SEGMENT = ['/self-employed', '/landlords', '/professionals', '/firms'];

describe('sales complete S1–S6', () => {
  it('S1 hub links four audience routes', async () => {
    const res = await request('/');
    assert.equal(res.status, 200);
    for (const p of SEGMENT) {
      assert.match(res.body, new RegExp(p.replace('/', '\\/')));
    }
    assert.match(res.body, /Get started free/);
  });

  it('S2 segment pages have problem, steps, CTA, FAQ', async () => {
    for (const p of SEGMENT) {
      const res = await request(p);
      assert.equal(res.status, 200, p);
      assert.match(res.body, /The problem|problem/i, p);
      assert.match(res.body, /Get started free/, p);
      assert.match(res.body, /Common questions|faq-list/, p);
      assert.match(res.body, /flow|How it works|How firms start|New to Spreadsheet/, p);
    }
  });

  it('S3 pricing has five named packages + experimental labels', async () => {
    const res = await request('/pricing');
    assert.equal(res.status, 200);
    assert.ok((res.body.match(/data-plan="/g) || []).length >= 5);
    assert.match(res.body, /Experimental/);
    assert.match(res.body, /Paid plans not available yet/i);
  });

  it('S4 support map live', async () => {
    for (const p of [
      '/how-it-works',
      '/templates',
      '/security',
      '/privacy',
      '/help',
      '/license',
      '/legal',
      '/terms',
    ]) {
      const res = await request(p);
      // 200 OK or redirect to canonical path (e.g. /templates → trailing slash)
      assert.ok([200, 301, 302, 308].includes(res.status), `${p} → ${res.status}`);
    }
  });

  it('S5 analytics module on marketing HTML', async () => {
    const res = await request('/');
    assert.match(res.body, /analytics\.js/);
    assert.match(res.body, /data-cta|get-started-free/);
  });

  it('S6 no HMRC recognised claim as listed', async () => {
    for (const p of ['/', '/security', '/pricing', '/self-employed']) {
      const res = await request(p);
      assert.doesNotMatch(res.body, /HMRC.recognised software list\.|is HMRC.recognised/i);
      assert.match(res.body, /not.*recognised|Not HMRC-recognised|not.*on HMRC/i, p);
    }
  });

  it('S7 moderated log exists', () => {
    const f = path.join(root, 'docs/SALES-10-SECOND-MODERATED.md');
    assert.ok(fs.existsSync(f));
    const t = fs.readFileSync(f, 'utf8');
    assert.match(t, /S7:\s*PASS/i);
  });
});
