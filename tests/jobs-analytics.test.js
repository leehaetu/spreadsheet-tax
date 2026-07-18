import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-jobs-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'j.sqlite');
process.env.JOBS_SECRET = 'test-jobs';
process.env.EMAIL_LOG = '0';

const { default: app } = await import('../src/server.js');

let server;
let port;

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? Buffer.from(body) : null;
    const h = { ...headers };
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = data.length;
    }
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers: h },
      (res) => {
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

describe('analytics and jobs', () => {
  it('records CTA events without tax data', async () => {
    const res = await request(
      'POST',
      '/api/analytics/cta',
      JSON.stringify({ event: 'test_cta', path: '/', meta: { x: 1 } })
    );
    assert.equal(res.status, 200);
    const denied = await request('GET', '/api/metrics/summary');
    assert.equal(denied.status, 403);
    const metrics = await request('GET', '/api/metrics/summary', null, {
      'x-jobs-secret': 'test-jobs',
    });
    assert.equal(metrics.status, 200);
    const m = JSON.parse(metrics.body);
    assert.ok(m.ctaEvents >= 1);
  });

  it('runs purge job with secret', async () => {
    const denied = await request(
      'POST',
      '/api/jobs/run',
      JSON.stringify({ job: 'purge_anonymous_drafts' })
    );
    assert.equal(denied.status, 403);
    const ok = await request(
      'POST',
      '/api/jobs/run',
      JSON.stringify({ job: 'purge_anonymous_drafts', secret: 'test-jobs' })
    );
    assert.equal(ok.status, 200);
    const body = JSON.parse(ok.body);
    assert.equal(body.ok, true);
  });

  it('sales-weekly requires secret and returns aggregates', async () => {
    const denied = await request('GET', '/api/metrics/sales-weekly?days=7');
    assert.equal(denied.status, 403);

    // seed a CTA
    await request(
      'POST',
      '/api/analytics/cta',
      JSON.stringify({ event: 'get-started-free', path: '/pricing' })
    );

    const ok = await request('GET', '/api/metrics/sales-weekly?days=7', null, {
      'x-jobs-secret': 'test-jobs',
    });
    assert.equal(ok.status, 200);
    const body = JSON.parse(ok.body);
    assert.equal(body.ok, true);
    assert.ok(body.days === 7);
    assert.ok(typeof body.registers === 'number');
    assert.ok(typeof body.ctaEvents === 'number');
    assert.ok(Array.isArray(body.ctaByEvent));
    assert.ok(body.ctaEvents >= 1);
    assert.ok(
      body.ctaByEvent.some((r) => r.event === 'get-started-free' || r.event === 'test_cta')
    );
    // never expose email-looking keys
    assert.equal(body.emails, undefined);
    assert.equal(body.users, undefined);
  });
});
