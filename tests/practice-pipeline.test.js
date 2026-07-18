/**
 * Practice work queue: full pipeline states, action labels, transitions.
 * Does not claim 200-practice / 800k capacity.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-practice-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'practice.sqlite');
delete process.env.HMRC_ALLOW_LIVE_SUBMIT;

const { default: app } = await import('../src/server.js');
const {
  listAllowedTransitions,
  listWorkflowStatusCatalog,
  nextActionLabel,
} = await import('../src/lib/practice-db.js');
const { PRACTICE_CLIENT_STATES } = await import(
  '../src/lib/taxpayer-journey.js'
);

let server;
let port;
let cookie = '';

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body != null ? Buffer.from(body) : null;
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = data.length;
    }
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers },
      (res) => {
        const sc = res.headers['set-cookie'];
        if (sc) cookie = sc.map((c) => c.split(';')[0]).join('; ');
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
  await request(
    'POST',
    '/api/auth/login',
    JSON.stringify({
      email: 'demo@spreadsheet-tax.example',
      password: 'DemoPass123!',
    })
  );
});

after(async () => {
  await new Promise((r, j) => server.close((e) => (e ? j(e) : r())));
});

describe('practice pipeline product', () => {
  it('catalog covers full pipeline with human labels', () => {
    const cat = listWorkflowStatusCatalog();
    assert.ok(cat.length >= 15);
    assert.ok(cat.some((s) => s.id === 'awaiting_client_approval'));
    assert.ok(cat.some((s) => s.id === 'year_complete'));
    assert.ok(cat.some((s) => s.id === 'queued'));
    for (const id of PRACTICE_CLIENT_STATES) {
      assert.ok(
        cat.some((s) => s.id === id),
        `catalog missing ${id}`
      );
    }
  });

  it('allowed transitions expose actionLabel', () => {
    const t = listAllowedTransitions('ready_to_submit');
    assert.ok(t.some((x) => x.id === 'queued'));
    assert.ok(t.some((x) => x.id === 'submitted'));
    for (const x of t) {
      assert.ok(x.actionLabel, `${x.id} needs actionLabel`);
      assert.ok(x.label);
    }
    assert.match(
      nextActionLabel('ready_to_submit', 'queued'),
      /Queue for HMRC/i
    );
  });

  it('workspace serves practice work queue copy', async () => {
    const res = await request('GET', '/workspace');
    assert.equal(res.status, 200);
    assert.match(res.body, /Practice work queue|Clients/i);
    assert.match(res.body, /awaiting client approval|year complete/i);
  });

  it('demo firm has multi-state portfolio with transitions', async () => {
    const firms = await request('GET', '/api/me/firms');
    assert.equal(firms.status, 200);
    const firmList = JSON.parse(firms.body).firms || JSON.parse(firms.body);
    // API shape may be { firms } or array via memberships
    const me = await request('GET', '/api/auth/me');
    const memberships = JSON.parse(me.body).memberships || [];
    assert.ok(memberships.length >= 1);
    const firmId = memberships[0].firmId;

    const clientsRes = await request(
      'GET',
      `/api/me/clients?firmId=${encodeURIComponent(firmId)}&limit=50`
    );
    assert.equal(clientsRes.status, 200);
    const data = JSON.parse(clientsRes.body);
    assert.ok((data.clients || []).length >= 8, 'richer demo portfolio');
    const statuses = new Set(data.clients.map((c) => c.status));
    assert.ok(statuses.size >= 5, 'multiple workflow states in demo');
    const withT = data.clients.find((c) => (c.transitions || []).length);
    assert.ok(withT, 'clients include allowed transitions');
    assert.ok(withT.transitions[0].actionLabel);

    // Advance one client via allowed transition
    const movable = data.clients.find(
      (c) => c.status === 'awaiting_records' && c.transitions?.length
    );
    if (movable) {
      const next = movable.transitions[0].id;
      const patch = await request(
        'PATCH',
        `/api/me/clients/${encodeURIComponent(movable.id)}/workflow`,
        JSON.stringify({ status: next, note: 'practice pipeline test' })
      );
      assert.equal(patch.status, 200, patch.body);
      const body = JSON.parse(patch.body);
      assert.equal(body.client.status, next);
    }

    const statusesApi = await request('GET', '/api/me/workflow-statuses');
    assert.equal(statusesApi.status, 200);
    const st = JSON.parse(statusesApi.body).statuses;
    assert.ok(st.length >= 15);
  });
});
