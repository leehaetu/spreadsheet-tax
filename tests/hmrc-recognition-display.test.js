/**
 * Ensure recognition status is machine-readable and injected on HTML pages.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-rec-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'r.sqlite');
process.env.HMRC_OAUTH_MOCK = '1';
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');
const { HMRC_RECOGNISED_SOFTWARE, HMRC_RECOGNITION_SHORT } = await import(
  '../src/lib/hmrc-recognition.js'
);

let server;
let port;

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          })
        );
      }
    );
    req.on('error', reject);
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

describe('HMRC recognition display', () => {
  it('source of truth is not recognised until flipped; goal is HMRC Recognised', () => {
    assert.equal(HMRC_RECOGNISED_SOFTWARE, false);
    assert.match(HMRC_RECOGNITION_SHORT, /HMRC Recognised/i);
    assert.match(HMRC_RECOGNITION_SHORT, /not yet recognised/i);
  });

  it('health and integrity expose hmrcRecognisedSoftware false + goal', async () => {
    const health = JSON.parse((await request('/health')).body);
    assert.equal(health.hmrcRecognisedSoftware, false);
    assert.ok(health.appVersion);
    assert.match(health.hmrcRecognisedLabel || '', /HMRC Recognised/i);
    assert.equal(health.hmrcRecognisedGoal, 'HMRC Recognised');

    const integrity = JSON.parse((await request('/api/integrity')).body);
    assert.equal(integrity.hmrcRecognisedSoftware, false);

    const status = JSON.parse((await request('/api/status')).body);
    assert.equal(status.hmrcRecognisedSoftware, false);
  });

  it('HTML pages inject site-chrome recognition script', async () => {
    for (const p of ['/', '/app', '/security', '/sales.html', '/pricing']) {
      const res = await request(p);
      assert.equal(res.status, 200, p);
      assert.match(res.body, /site-chrome\.js/, p);
    }
  });

  it('static site-chrome.js contains goal + not yet wording', async () => {
    const res = await request('/js/site-chrome.js');
    assert.equal(res.status, 200);
    assert.match(res.body, /HMRC Recognised/);
    assert.match(res.body, /not yet recognised/i);
  });
});
