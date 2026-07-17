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
    assert.ok(html.length > 500, 'sales HTML must be non-empty');
    assert.match(html, /Upload|Start|Get started|Download/i);
    assert.match(html, /bookkeeper|accountant/i);
    assert.match(html, /practice|firm/i);
    assert.match(html, /client portal|clients of/i);
    assert.match(html, /license|subscription/i);
    assert.match(html, /Lee Hine/i);
    assert.doesNotMatch(html, /\bAI\b|artificial intelligence|ChatGPT|OpenAI/i);
    assert.doesNotMatch(html, /implementer|TODO for Lee|advice for me/i);
    assert.doesNotMatch(html, /test double|sandbox client|test-spreadsheets\//i);
  });

  it('provides distinct conversion journeys for each primary audience', async () => {
    const journeys = [
      ['/self-employed', /sole traders|self-employed/i, /check my spreadsheet/i],
      ['/landlords', /property landlords|landlord records/i, /property spreadsheet/i],
      ['/professionals', /bookkeepers and accountants/i, /professional workspace|accountant workspace/i],
      ['/firms', /accountancy firms|multi-user practices/i, /practice dashboard/i],
    ];

    for (const [urlPath, audiencePattern, ctaPattern] of journeys) {
      const res = await request('GET', urlPath);
      assert.equal(res.status, 200, `${urlPath} should be available`);
      const html = res.body.toString('utf8');
      assert.match(html, audiencePattern);
      assert.match(html, ctaPattern);
      assert.match(html, /Spreadsheet Tax/i);
      assert.doesNotMatch(html, /test double|sandbox client|TODO/i);
    }
  });
});

describe('bridging app customer focus', () => {
  it('presents task language without developer-only default copy', async () => {
    const res = await request('GET', '/app');
    assert.equal(res.status, 200);
    const html = res.body.toString('utf8');
    assert.ok(html.length > 400, 'app HTML must be non-empty');
    // Customer task flow
    assert.match(html, /Upload your spreadsheet|Upload your/i);
    assert.match(html, /Check your figures|Review my figures|before sending/i);
    assert.match(html, /Submit quarterly update|Send to HMRC/i);
    // Polished multi-step product surface
    assert.match(html, /Drop your spreadsheet|Choose a CSV|Review my figures/i);
    assert.match(html, /Total income|Total expenses|Continue to send/i);
    // Must not surface implementer/dev defaults as primary copy
    assert.doesNotMatch(html, /test double/i);
    assert.doesNotMatch(html, /sandbox client/i);
    assert.doesNotMatch(html, /test-spreadsheets\//i);
    assert.doesNotMatch(html, /in-process test double/i);
    assert.doesNotMatch(html, /HMRC:\s*…|HMRC:\s*double|HMRC:\s*sandbox/i);
    assert.doesNotMatch(html, /\bAI\b|artificial intelligence|ChatGPT|OpenAI/i);
    assert.doesNotMatch(html, /implementer|TODO for Lee|advice for me/i);
    // Prefer customer framing over raw "payload" headings
    assert.doesNotMatch(html, /Preview mapped figures\s*&\s*payloads/i);
    assert.doesNotMatch(html, /Payload path/i);
  });

  it('ships app client without developer mode labels as default UI text', async () => {
    const jsPath = path.join(root, 'public', 'js', 'app.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    // connectionLabel must map modes to customer wording
    assert.match(js, /connectionLabel|Ready to submit|Connected to HMRC/i);
    assert.doesNotMatch(js, /textContent\s*=\s*`HMRC:\s*\$\{/);
    assert.doesNotMatch(js, /test double/i);
  });
});

describe('sample import API', () => {
  it('returns customer summary for a combined sample period', async () => {
    const res = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ sample: 'combined' });
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/import/sample',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (r) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => {
            resolve({
              status: r.statusCode,
              body: Buffer.concat(chunks),
            });
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body.toString('utf8'));
    assert.equal(data.ok, true);
    assert.ok(data.summary);
    assert.ok(data.summary.totals);
    assert.ok(data.summary.sources?.length >= 1);
    assert.ok(data.payloads);
    assert.equal(data.sources.selfEmployment, true);
  });

  it('lists customer-facing sample scenarios', async () => {
    const res = await request('GET', '/api/samples');
    assert.equal(res.status, 200);
    const data = JSON.parse(res.body.toString('utf8'));
    assert.ok(data.samples?.length >= 3);
    assert.ok(data.samples.every((s) => s.label && s.id));
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

  it('exposes accountancy workflow statuses and allowed client transitions', async () => {
    const statuses = await request('GET', '/api/workflow-statuses');
    assert.equal(statuses.status, 200);
    const sj = JSON.parse(statuses.body.toString('utf8'));
    assert.ok(sj.statuses.some((x) => x.id === 'ready_to_submit'));

    const client = await request('GET', '/api/clients/cli-1');
    assert.equal(client.status, 200);
    const cj = JSON.parse(client.body.toString('utf8'));
    assert.ok(Array.isArray(cj.transitions));
    assert.ok(cj.client.dueDate);
    assert.ok(Array.isArray(cj.client.activity));
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
