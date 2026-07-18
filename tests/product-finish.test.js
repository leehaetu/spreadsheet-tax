/**
 * Product finish bar: shell, HMRC-mirror, quarterly gate, banned customer copy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

const PRODUCT_PAGES = [
  'home.html',
  'app.html',
  'onboarding.html',
  'year-end.html',
  'records.html',
  'history.html',
  'account.html',
  'guide.html',
  'connect-hmrc.html',
];

const BANNED =
  /sandbox connected|preview mode|fictional figures|try a sample first|run preview submit|fill business ids from hmrc|show due periods|practise safely|who can use this account/i;

describe('product finish — customer shell', () => {
  it('sign-in has no authenticated product nav chrome', () => {
    const html = fs.readFileSync(path.join(publicDir, 'signin.html'), 'utf8');
    assert.match(html, /auth-product-shell/);
    assert.doesNotMatch(html, /cc-nav[\s\S]*Quarterly updates/);
    assert.doesNotMatch(html, /href="\/home">Home<\/a>/);
    assert.match(html, /Sign in/);
  });

  it('product pages load shared shell script', () => {
    for (const page of PRODUCT_PAGES) {
      const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
      assert.match(html, /product-shell\.js/, `${page} missing product-shell.js`);
    }
  });

  it('product shell nav labels are HMRC-aligned', () => {
    const js = fs.readFileSync(path.join(publicDir, 'js/product-shell.js'), 'utf8');
    assert.match(js, /Quarterly updates/);
    assert.match(js, /Year end/);
    assert.match(js, /Sources/);
    assert.match(js, /History/);
    assert.match(js, /Settings/);
    assert.match(js, /Help/);
    assert.doesNotMatch(js, /Tax return/);
    assert.doesNotMatch(js, /Messages/);
  });
});

describe('product finish — banned customer copy on product pages', () => {
  it('does not surface sandbox/demo/practice/preview theatre in product HTML', () => {
    for (const page of PRODUCT_PAGES) {
      const html = fs.readFileSync(path.join(publicDir, page), 'utf8');
      // operator tools section may still contain sandbox ids in connect-hmrc — only fail if customer-visible theatre
      if (page === 'connect-hmrc.html') {
        assert.doesNotMatch(html, /You are in sandbox mode|Preview only|fictional figures|Try a sample/i);
        continue;
      }
      assert.doesNotMatch(html, BANNED, `banned copy in ${page}`);
    }
  });

  it('site-chrome does not inject sandbox/preview mode pills on product paths', () => {
    const js = fs.readFileSync(path.join(publicDir, 'js/site-chrome.js'), 'utf8');
    assert.doesNotMatch(js, /HMRC sandbox/);
    assert.doesNotMatch(js, /Preview only — not sent to HMRC/);
    assert.match(js, /isProductShellPath/);
  });
});

describe('product finish — HMRC mirror & quarterly', () => {
  it('onboarding is HMRC-load only (no create-business UI)', () => {
    const html = fs.readFileSync(path.join(publicDir, 'onboarding.html'), 'utf8');
    assert.match(html, /Load businesses from HMRC/);
    assert.doesNotMatch(html, /Add self-employment business|data-add-type=/i);
    assert.match(html, /cannot create an HMRC business|does not create businesses/i);
  });

  it('quarterly hard-gates on HMRC connection', () => {
    const js = fs.readFileSync(path.join(publicDir, 'js/quarterly-sources.js'), 'utf8');
    assert.match(js, /Connect HMRC before starting a quarterly update/);
    assert.match(js, /connection\?\.connected/);
    assert.match(js, /lockWorkflow/);
  });

  it('quarterly upload copy is explicit and period-focused', () => {
    const html = fs.readFileSync(path.join(publicDir, 'app.html'), 'utf8');
    assert.match(html, /Click to choose a spreadsheet or drag it here/);
    assert.match(html, /Download free template|Download CSV template/);
    assert.match(html, /current quarter/);
    assert.match(html, /Choose an income source/);
  });

  it('year-end uses exclusive multi-step questionnaire and Year end label', () => {
    const html = fs.readFileSync(path.join(publicDir, 'year-end.html'), 'utf8');
    assert.match(html, /Year end/);
    assert.match(html, /data-ye-card="q1"/);
    assert.match(html, /data-ye-card="q2"/);
    assert.match(html, /data-ye-card="q3"/);
    assert.match(html, /data-ye-card="q4"/);
    assert.match(html, /data-ye-card="checklist"/);
    assert.match(html, /data-ye-card="work"/);
    assert.match(html, /data-ye-card="done"/);
    assert.match(html, /self-employment income/i);
    assert.match(html, /UK property/i);
    assert.match(html, /foreign property/i);
    assert.match(html, /losses or other adjustments/i);
    assert.doesNotMatch(html, /connection mode remains visible/i);
    assert.doesNotMatch(html, /Tax return/);
  });

  it('year-end JS drives exclusive cards and HMRC gate', () => {
    const js = fs.readFileSync(path.join(publicDir, 'js/year-end.js'), 'utf8');
    assert.match(js, /showYeCard/);
    assert.match(js, /data-ye-answer/);
    assert.match(js, /Connect HMRC before starting year-end/);
    assert.match(js, /connection\?\.connected/);
    assert.match(js, /ye-start-steps/);
    assert.match(js, /ye-restart-guide/);
  });

  it('history is submission history; records are sources', () => {
    const history = fs.readFileSync(path.join(publicDir, 'history.html'), 'utf8');
    assert.match(history, /Submission history/);
    const records = fs.readFileSync(path.join(publicDir, 'records.html'), 'utf8');
    assert.match(records, /Sources|Income sources/);
  });

  it('settings keep technical business IDs off the primary surface', () => {
    const html = fs.readFileSync(path.join(publicDir, 'account.html'), 'utf8');
    assert.match(html, /Settings/);
    assert.match(html, /settings-advanced|Advanced — HMRC business identifiers/);
  });
});

describe('product finish plan exists', () => {
  it('documents owner bar and work packages', () => {
    const plan = fs.readFileSync(
      path.join(root, 'docs/PRODUCT-FINISH-PLAN.md'),
      'utf8'
    );
    assert.match(plan, /bridging app/i);
    assert.match(plan, /HMRC/);
    assert.match(plan, /Test plan/i);
    assert.match(plan, /product-finish\.spec\.js/);
  });
});

describe('product finish — e2e checklist present', () => {
  it('ships Playwright product-finish and helpers', () => {
    const e2e = fs.readFileSync(
      path.join(root, 'tests/e2e/product-finish.spec.js'),
      'utf8'
    );
    assert.match(e2e, /Product finish checklist/);
    assert.match(e2e, /mockHmrcConnected/);
    assert.match(e2e, /Connect HMRC before starting year-end/);
    const helpers = fs.readFileSync(
      path.join(root, 'tests/e2e/helpers.js'),
      'utf8'
    );
    assert.match(helpers, /mockHmrcConnected/);
  });
});

describe('product finish — history & home honesty', () => {
  it('history uses Connected/Not connected without mode theatre', () => {
    const js = fs.readFileSync(path.join(publicDir, 'js/history.js'), 'utf8');
    assert.match(js, /history-table/);
    assert.match(js, /connectionLabel|stConnectionLabel/);
    assert.doesNotMatch(js, /Production HMRC configured/);
    assert.doesNotMatch(js, /Connected in \$\{/);
    assert.doesNotMatch(js, /local mock connection is active/i);
  });

  it('home next task adapts when HMRC is not connected', () => {
    const js = fs.readFileSync(
      path.join(publicDir, 'js/taxpayer-home.js'),
      'utf8'
    );
    assert.match(js, /Connect HMRC to continue/);
    assert.match(js, /Load your income sources/);
    assert.match(js, /loadConnection/);
  });
});
