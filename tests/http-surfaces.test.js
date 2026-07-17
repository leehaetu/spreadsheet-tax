/**
 * HTTP-level tests against the real Express app (no listen race):
 * template download, sales copy constraints, portal surfaces.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
const { default: app } = await import('../src/server.js');

/** @type {http.Server} */
let server;
/** @type {number} */
let port;

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
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

describe('template download', () => {
  for (const urlPath of [
    '/download/template',
    '/templates/period-summary-template.csv',
    '/api/template',
  ]) {
    it(`${urlPath} returns non-empty CSV with sections`, async () => {
      const res = await request('GET', urlPath);
      assert.equal(res.status, 200);
      const text = res.body.toString('utf8');
      assert.ok(res.body.length > 100, 'body must be non-empty spreadsheet');
      assert.match(text, /section/i);
      assert.match(text, /self_employment/);
      assert.match(text, /uk_property/);
      assert.match(text, /foreign_property/);
      const cd = res.headers['content-disposition'] || '';
      assert.match(cd, /attachment/i);
      assert.match(cd, /period-summary-template\.csv/i);
      const ct = res.headers['content-type'] || '';
      assert.match(ct, /csv|text/i);
    });
  }

  it('matches on-disk template file content', async () => {
    const disk = fs.readFileSync(
      path.join(root, 'templates', 'period-summary-template.csv')
    );
    const res = await request('GET', '/download/template');
    assert.equal(res.body.toString('utf8'), disk.toString('utf8'));
  });
});

describe('sales site customer focus', () => {
  it('has conversion CTAs and firm/client audiences, no AI claims', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    const html = res.body.toString('utf8');
    assert.match(html, /Upload|Start|Get started|Download/i);
    assert.match(html, /bookkeeper|accountant/i);
    assert.match(html, /practice|firm/i);
    assert.match(html, /client portal|clients of/i);
    assert.match(html, /license|subscription/i);
    assert.match(html, /Lee Hine/i);
    assert.doesNotMatch(html, /\bAI\b|artificial intelligence|ChatGPT|OpenAI/i);
    assert.doesNotMatch(html, /implementer|TODO for Lee|advice for me/i);
  });
});

describe('portal surfaces', () => {
  it('accountant, practice, and client portal are distinct', async () => {
    const acc = await request('GET', '/accountant');
    const prac = await request('GET', '/practice');
    const portal = await request('GET', '/portal');
    assert.equal(acc.status, 200);
    assert.equal(prac.status, 200);
    assert.equal(portal.status, 200);
    const a = acc.body.toString('utf8');
    const p = prac.body.toString('utf8');
    const c = portal.body.toString('utf8');
    assert.match(a, /Accountant|bookkeeper/i);
    assert.match(p, /Practice|Multi-accountant/i);
    assert.match(c, /Client portal/i);
    assert.notEqual(a, p);
    assert.notEqual(p, c);
  });

  it('practice APIs return demo firms and clients', async () => {
    const firms = await request('GET', '/api/firms');
    assert.equal(firms.status, 200);
    const fj = JSON.parse(firms.body.toString('utf8'));
    assert.ok(fj.firms.length >= 1);
    const clients = await request('GET', '/api/clients');
    const cj = JSON.parse(clients.body.toString('utf8'));
    assert.ok(cj.clients.length >= 1);
  });
});

describe('legal and license pages', () => {
  it('states Lee Hine IP and company subscription license', async () => {
    const legal = await request('GET', '/legal');
    const lic = await request('GET', '/license');
    assert.equal(legal.status, 200);
    assert.equal(lic.status, 200);
    const text = legal.body.toString('utf8') + lic.body.toString('utf8');
    assert.match(text, /Lee Hine/);
    assert.match(text, /modifications|improvements/i);
    assert.match(text, /subscription/i);
  });
});
