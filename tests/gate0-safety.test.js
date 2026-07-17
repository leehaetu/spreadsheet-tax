/**
 * Gate 0 safety: no live credentials on public submit; practice writes frozen; privacy status.
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
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;
delete process.env.DEMO_PRACTICE_WRITES;
process.env.HMRC_ACCESS_TOKEN = 'should-not-be-used-token';
process.env.HMRC_CLIENT_ID = 'should-not-enable-sandbox';

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

describe('Gate 0 submit safety', () => {
  it('status reports double mode and accurate privacy flags', async () => {
    const res = await request('GET', '/api/status');
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.hmrcMode, 'double');
    assert.equal(json.liveSubmitEnabled, false);
    assert.equal(json.fileUploadedForMapping, true);
    assert.equal(json.recordsStayInSpreadsheet, true);
    assert.notEqual(json.recordsStayLocal, true);
  });

  it('submit uses double mode even if env token present', async () => {
    const sample = await request(
      'POST',
      '/api/import/sample',
      JSON.stringify({ sample: 'self_employment' })
    );
    assert.equal(sample.status, 200);
    const imported = JSON.parse(sample.body);
    const submitBody = JSON.stringify({
      payloads: imported.payloads,
      nino: 'AA123456A',
      taxYear: '2024-25',
      businessIdSe: 'XAIS12345678901',
    });
    const res = await request('POST', '/api/submit', submitBody);
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.mode, 'double');
    assert.equal(json.liveSubmitEnabled, false);
    assert.ok(json.ok);
  });

  it('practice workflow writes are frozen by default', async () => {
    const res = await request(
      'PATCH',
      '/api/clients/cli-1/workflow',
      JSON.stringify({ status: 'in_review' })
    );
    assert.equal(res.status, 403);
    const json = JSON.parse(res.body);
    assert.equal(json.frozen, true);
  });
});

describe('Gate 0 privacy copy', () => {
  it('sales and app pages do not promise never-leave-device', async () => {
    for (const p of ['/', '/app']) {
      const res = await request('GET', p);
      assert.equal(res.status, 200);
      assert.doesNotMatch(res.body, /never leaves (your )?device/i);
      assert.doesNotMatch(res.body, /recordsStayLocal/i);
    }
    const security = await request('GET', '/security');
    assert.equal(security.status, 200);
    // Security page may refute the myth; must not claim files never leave the device as a promise
    assert.doesNotMatch(
      security.body,
      /files never leave|your file never leaves/i
    );
    assert.match(security.body, /not the same as/i);
  });

  it('security page explains upload for mapping', async () => {
    const res = await request('GET', '/security');
    assert.match(res.body, /upload/i);
    assert.match(res.body, /map(ping)?|period spreadsheet/i);
  });
});

describe('docs OS present', () => {
  it('completion plan and status exist', () => {
    assert.ok(fs.existsSync(path.join(root, 'docs', 'COMPLETION-PLAN.md')));
    assert.ok(fs.existsSync(path.join(root, 'docs', 'STATUS.md')));
    assert.ok(fs.existsSync(path.join(root, 'docs', 'ULTIMATE-PRODUCT-PLAN.md')));
  });
});
