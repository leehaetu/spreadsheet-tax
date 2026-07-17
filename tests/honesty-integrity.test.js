/**
 * Honesty gates for HMRC-inspectable product claims.
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

const { default: app } = await import('../src/server.js');

let server;
let port;

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method },
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

describe('honesty and integrity', () => {
  it('exposes machine-readable integrity map', async () => {
    const res = await request('GET', '/api/integrity');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.layers.spreadsheetImportMapping.real, true);
    assert.equal(j.layers.submitPreviewDouble.isHmrcFiling, false);
    assert.equal(j.layers.publicDemoPracticePortfolio.fictional, true);
    assert.equal(j.layers.billing.cardPayments, false);
    assert.equal(j.layers.email.delivered, false);
  });

  it('demo practice APIs are labelled fictional', async () => {
    const res = await request('GET', '/api/firms');
    assert.equal(res.status, 200);
    const j = JSON.parse(res.body);
    assert.equal(j.demo, true);
    assert.equal(j.fictional, true);
  });

  it('integrity page and app copy do not claim fake acceptance', async () => {
    const page = await request('GET', '/integrity');
    assert.equal(page.status, 200);
    assert.match(page.body, /not call HMRC|not sent to HMRC|preview/i);
    const sales = fs.readFileSync(path.join(root, 'public/sales.html'), 'utf8');
    assert.match(sales, /illustrative|example scenario|not customer reviews/i);
    assert.doesNotMatch(sales, /Submit with confidence/);
    const appJs = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
    assert.match(appJs, /NOT sent to HMRC/);
    assert.doesNotMatch(
      appJs,
      /were accepted \(\$\{count\} income/
    );
  });

  it('accountant demo page is labelled demonstration', async () => {
    const res = await request('GET', '/accountant');
    assert.equal(res.status, 200);
    assert.match(res.body, /Demonstration portfolio|fictional/i);
  });
});
