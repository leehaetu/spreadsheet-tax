/**
 * Structural proof that the durable all-screens UX audit pack is complete.
 * Drives the real shipped generator inventory + on-disk artifacts (not a reimplementation).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pack = path.join(root, 'docs/audits/2026-07-18-all-screens');
const shots = path.join(pack, 'screenshots');
const pdf = path.join(pack, 'spreadsheet-tax-all-screens-audit-2026-07-18.pdf');
const generator = path.join(root, 'scripts/build-screen-audit-pdf.py');

/**
 * Parse the real generator’s SCREENS list (source of truth for comments).
 * @param {string} src
 */
function parseScreenEntries(src) {
  const entries = [];
  const re =
    /\('([^']+\.png)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*\[([\s\S]*?)\]\s*,?\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const findings = [...m[5].matchAll(/'((?:\\'|[^'])*)'/g)].map((x) =>
      x[1].replace(/\\'/g, "'")
    );
    entries.push({
      file: m[1],
      route: m[2],
      title: m[3],
      priority: m[4],
      findings,
    });
  }
  return entries;
}

describe('all-screens audit pack (durable deliverable)', () => {
  it('ships generator, README, STATUS pointer, and illustrated PDF', () => {
    assert.ok(fs.existsSync(generator), 'build-screen-audit-pdf.py missing');
    assert.ok(fs.existsSync(path.join(pack, 'README.md')), 'pack README missing');
    assert.ok(fs.existsSync(pdf), 'audit PDF missing under docs/audits');
    const st = fs.statSync(pdf);
    assert.ok(st.size > 1_000_000, `PDF too small: ${st.size}`);
    const status = fs.readFileSync(path.join(root, 'docs/STATUS.md'), 'utf8');
    assert.match(status, /audits\/2026-07-18-all-screens/);
  });

  it('generator inventory has ≥51 screens each with route, priority, and ≥3 unique comments', () => {
    const src = fs.readFileSync(generator, 'utf8');
    const entries = parseScreenEntries(src);
    assert.ok(entries.length >= 51, `expected ≥51 screens, got ${entries.length}`);
    const firsts = new Set();
    for (const e of entries) {
      assert.ok(e.file.endsWith('.png'), e.file);
      assert.ok(e.route.length > 0, e.file);
      assert.match(e.priority, /^P[01]$/, `${e.file} priority ${e.priority}`);
      assert.ok(
        e.findings.length >= 3,
        `${e.file} needs ≥3 findings, got ${e.findings.length}`
      );
      firsts.add(e.findings[0]);
    }
    // Comments must be screen-specific, not one boilerplate block repeated
    assert.ok(
      firsts.size >= Math.floor(entries.length * 0.8),
      `first findings not diverse enough: ${firsts.size}/${entries.length}`
    );
  });

  it('every generator entry has a real non-trivial PNG on disk', () => {
    const src = fs.readFileSync(generator, 'utf8');
    const entries = parseScreenEntries(src);
    for (const e of entries) {
      const p = path.join(shots, e.file);
      assert.ok(fs.existsSync(p), `missing screenshot ${e.file}`);
      const size = fs.statSync(p).size;
      assert.ok(size > 5_000, `${e.file} too small (${size})`);
      // PNG magic
      const fd = fs.openSync(p, 'r');
      const buf = Buffer.alloc(8);
      fs.readSync(fd, buf, 0, 8, 0);
      fs.closeSync(fd);
      assert.equal(buf[0], 0x89);
      assert.equal(buf.toString('ascii', 1, 4), 'PNG');
    }
  });

  it('covers primary customer HTML surfaces from public/', () => {
    const src = fs.readFileSync(generator, 'utf8');
    const entries = parseScreenEntries(src);
    const routes = new Set(
      entries.map((e) => e.route.split('?')[0].replace(/\/$/, '') || '/')
    );
    const required = [
      '/',
      '/self-employed',
      '/landlords',
      '/professionals',
      '/firms',
      '/pricing',
      '/app',
      '/home',
      '/workspace',
      '/connect-hmrc',
      '/signin',
      '/register',
      '/account',
      '/billing',
      '/history',
      '/year-end',
      '/onboarding',
      '/records',
    ];
    for (const r of required) {
      assert.ok(routes.has(r), `audit missing route ${r}`);
    }
    // public HTML files that are product surfaces should appear in captures
    // (signed-out and/or signed-in). leave-to-sales is transitional chrome.
    const publicHtml = fs
      .readdirSync(path.join(root, 'public'))
      .filter((f) => f.endsWith('.html') && f !== 'leave-to-sales.html');
    for (const f of publicHtml) {
      const stem = f.replace(/\.html$/, '');
      const route = stem === 'sales' ? '/' : `/${stem}`;
      const hit = entries.some(
        (e) =>
          e.route === route ||
          e.route.startsWith(route + ' ') ||
          e.route.startsWith(route + '?')
      );
      assert.ok(hit, `no audit capture for public/${f} (route ${route})`);
    }
  });

  it('rebuilds the illustrated PDF from the shipped generator and screenshots', () => {
    const r = spawnSync('python3', [generator], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.equal(r.status, 0, r.stderr || r.stdout || 'pdf rebuild failed');
    assert.match(r.stdout || '', /spreadsheet-tax-all-screens-audit/);
    const rebuilt = path.join(
      root,
      'output/pdf/spreadsheet-tax-all-screens-audit-2026-07-18.pdf'
    );
    assert.ok(fs.existsSync(rebuilt));
    assert.ok(fs.statSync(rebuilt).size > 1_000_000);
  });
});
