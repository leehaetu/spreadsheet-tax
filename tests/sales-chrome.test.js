/**
 * Sales chrome plan: shared nav marker, CTA vocabulary, no mode pill on auth entry.
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

const MARKETING = [
  '/',
  '/self-employed',
  '/landlords',
  '/professionals',
  '/firms',
  '/pricing',
  '/how-it-works',
  '/security',
  '/help',
  '/signin',
  '/register',
  '/forgot-password',
];

describe('sales chrome system', () => {
  it('injects sales-chrome.js on marketing and public auth pages', async () => {
    for (const p of MARKETING) {
      const res = await request(p);
      assert.equal(res.status, 200, p);
      assert.match(res.body, /sales-chrome\.js/, p);
    }
  });

  it('ships sales-chrome with data-sales-nav marker and CTA label', () => {
    const js = fs.readFileSync(
      path.join(root, 'public/js/sales-chrome.js'),
      'utf8'
    );
    assert.match(js, /data-sales-nav/);
    assert.match(js, /Get started free/);
    assert.match(js, /sales-nav-toggle/);
    assert.match(js, /data-cta/);
    assert.match(js, /get-started-free/);
  });

  it('site-chrome only shows mode pill on product shell paths', () => {
    const js = fs.readFileSync(
      path.join(root, 'public/js/site-chrome.js'),
      'utf8'
    );
    assert.match(js, /isProductShellPath/);
    assert.match(js, /\/home/);
    assert.match(js, /\/app/);
    // Gating must skip non-product paths (auth entry never listed)
    assert.doesNotMatch(js, /prefixes\s*=\s*\[[^\]]*\/signin/);
  });

  it('marketing HTML prefers Get started free over Create free account in primary CTAs', () => {
    const sales = fs.readFileSync(path.join(root, 'public/sales.html'), 'utf8');
    // After sales-chrome runs, static HTML should mostly use Get started free
    const createCount = (sales.match(/Create free account/g) || []).length;
    const getStarted = (sales.match(/Get started free/g) || []).length;
    assert.ok(getStarted >= 1, 'home should use Get started free');
    assert.equal(createCount, 0, 'home should not use Create free account');
  });

  it('signin does not embed mode-pill HTML (pill is JS-only and gated)', async () => {
    const res = await request('/signin');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.body, /st-mode-pill/);
    assert.doesNotMatch(res.body, /Preview only/);
    assert.doesNotMatch(res.body, /Marketing site/);
  });

  it('pricing owns paid-deferred honesty; home does not use Create free account', async () => {
    const pricing = await request('/pricing');
    assert.equal(pricing.status, 200);
    assert.match(pricing.body, /Paid plans not available yet/i);
    assert.match(pricing.body, /Get started free/);
    const home = await request('/');
    assert.equal(home.status, 200);
    assert.doesNotMatch(home.body, /Create free account/);
  });

  it('legal and help get sales-chrome injection', async () => {
    for (const p of ['/legal', '/help', '/privacy', '/terms']) {
      const res = await request(p);
      assert.equal(res.status, 200, p);
      assert.match(res.body, /sales-chrome\.js/, p);
    }
  });
});
