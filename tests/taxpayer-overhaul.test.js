/**
 * Taxpayer overhaul surfaces: setup, quarterly source picker, year-end editors, history.
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
/** @type {string[]} */
let cookieJar = [];

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
          ...(cookieJar.length ? { Cookie: cookieJar.join('; ') } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const set = res.headers['set-cookie'];
          if (set) {
            for (const c of Array.isArray(set) ? set : [set]) {
              const part = c.split(';')[0];
              const name = part.split('=')[0];
              cookieJar = cookieJar.filter((x) => !x.startsWith(name + '='));
              cookieJar.push(part);
            }
          }
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            /* html */
          }
          resolve({ status: res.statusCode, body: raw, json });
        });
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

describe('taxpayer overhaul HTML surfaces', () => {
  it('onboarding ships multi-step setup with manage modes and source picker', () => {
    const html = fs.readFileSync(path.join(root, 'public/onboarding.html'), 'utf8');
    assert.match(html, /Who will manage this account/);
    assert.match(html, /data-add-type="self_employment"/);
    assert.match(html, /data-add-type="uk_property"/);
    assert.match(html, /data-add-type="foreign_property"/);
    assert.match(html, /Save setup and go home/);
    assert.match(html, /onboarding\.js/);
  });

  it('app quarterly page includes source picker hook', () => {
    const html = fs.readFileSync(path.join(root, 'public/app.html'), 'utf8');
    assert.match(html, /quarterly-source-list/);
    assert.match(html, /quarterly-sources\.js/);
  });

  it('year-end includes eoy-editor host for adjustment forms', () => {
    const html = fs.readFileSync(path.join(root, 'public/year-end.html'), 'utf8');
    assert.match(html, /id="eoy-editor"/);
    const js = fs.readFileSync(path.join(root, 'public/js/year-end.js'), 'utf8');
    assert.match(js, /function renderEditor/);
    assert.match(js, /se_annual/);
    assert.match(js, /eoy-declaration/);
  });

  it('history ships filter, recovery, and client script', () => {
    const html = fs.readFileSync(path.join(root, 'public/history.html'), 'utf8');
    assert.match(html, /Submission history/);
    assert.match(html, /history-filter/);
    assert.match(html, /When something needs attention/);
    assert.match(html, /history\.js/);
  });
});

describe('taxpayer overhaul authenticated APIs', () => {
  it('saves multi-source setup and lists sources for quarterly picker', async () => {
    cookieJar = [];
    const email = `overhaul-${Date.now()}@example.com`;
    const reg = await request('POST', '/api/auth/register', {
      email,
      password: 'OverhaulPass1!',
      name: 'Overhaul User',
    });
    assert.ok([200, 201].includes(reg.status), reg.body);

    const sources = [
      {
        id: 'se-1',
        type: 'self_employment',
        label: 'Self-employment',
        nickname: 'Design trade',
      },
      {
        id: 'uk-1',
        type: 'uk_property',
        label: 'UK property',
        nickname: 'Bath flat',
        joint: true,
        ownershipShare: 50,
      },
      {
        id: 'fp-1',
        type: 'foreign_property',
        label: 'Foreign property',
        nickname: 'Spain villa',
        countryCode: 'ESP',
      },
      {
        id: 'fp-2',
        type: 'foreign_property',
        label: 'Foreign property',
        nickname: 'France flat',
        countryCode: 'FRA',
      },
    ];

    const profile = await request('PUT', '/api/me/taxpayer-profile', {
      manageMode: 'self',
      periodType: 'standard',
      taxYear: '2026-27',
      onboardingComplete: true,
      meta: {
        sourceDetails: {
          'se-1': { trade: 'Design', accountingPeriod: '6 April to 5 April' },
        },
      },
    });
    assert.equal(profile.status, 200, profile.body);

    const put = await request('PUT', '/api/me/income-sources', { sources });
    assert.equal(put.status, 200, put.body);

    const get = await request('GET', '/api/me/income-sources');
    assert.equal(get.status, 200);
    assert.equal((get.json.sources || []).length, 4);
    const foreign = (get.json.sources || []).filter((s) => s.type === 'foreign_property');
    assert.equal(foreign.length, 2);

    const pages = ['/onboarding', '/history', '/app', '/year-end'];
    for (const p of pages) {
      const res = await request('GET', p);
      assert.equal(res.status, 200, p);
    }
  });
});
