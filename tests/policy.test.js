/**
 * Structural policy: no enums, no AI product claims, mobile projects exist, LICENSE present.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe('IP and LICENSE', () => {
  it('LICENSE asserts Lee Hine ownership and company subscription license', () => {
    const lic = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
    assert.match(lic, /Lee Hine/);
    assert.match(lic, /modifications|improvements/i);
    assert.match(lic, /subscription/i);
    assert.match(lic, /companies/i);
  });

  it('package.json and lock root are proprietary, not MIT', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    );
    assert.ok(
      pkg.license === 'UNLICENSED' ||
        /^SEE LICENSE$/i.test(String(pkg.license)) ||
        /proprietary/i.test(String(pkg.license)),
      `package.json license must be proprietary, got ${pkg.license}`
    );
    assert.notEqual(pkg.license, 'MIT');
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')
    );
    const rootPkg = lock.packages && lock.packages[''];
    assert.ok(rootPkg, 'package-lock packages[""] missing');
    assert.equal(
      rootPkg.license,
      pkg.license,
      'package-lock root license must match package.json'
    );
    assert.notEqual(rootPkg.license, 'MIT');
  });
});

describe('no language enumerations in product source', () => {
  it('does not introduce TypeScript/JS enumeration constructs in src, public, mobile', () => {
    // Scan product code only (not this policy file, which discusses the rule)
    const dirs = ['src', 'public', 'mobile'].map((d) => path.join(root, d));
    const files = dirs.flatMap((d) => walk(d)).filter((f) => {
      return /\.(js|ts|tsx|jsx)$/.test(f);
    });
    const offenders = [];
    // Match language keyword only: `enumeration` style `enum Name` or `enum {`
    // Built without writing the banned token as a contiguous word in a way that
    // trips naive self-scan of product files.
    const banned = new RegExp('\\b' + 'en' + 'um' + '\\s+[A-Za-z_]|\\b' + 'en' + 'um' + '\\s*\\{');
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (banned.test(text)) {
        offenders.push(path.relative(root, f));
      }
    }
    assert.deepEqual(offenders, [], `banned construct found: ${offenders.join(', ')}`);
  });
});

describe('no AI product claims in user-facing copy', () => {
  it('public HTML/JS has no AI marketing strings', () => {
    const publicDir = path.join(root, 'public');
    const files = walk(publicDir).filter((f) => /\.(html|js|css)$/.test(f));
    const bad = [];
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (/\bAI\b|artificial intelligence|ChatGPT|OpenAI|machine learning|LLM\b/i.test(text)) {
        bad.push(path.relative(root, f));
      }
    }
    assert.deepEqual(bad, [], `AI mentions: ${bad.join(', ')}`);
  });
});

describe('mobile iOS and Android projects', () => {
  it('Expo app exists with product URL and platform config', () => {
    const appJs = path.join(root, 'mobile', 'spreadsheet-tax-app', 'App.js');
    const appJson = path.join(root, 'mobile', 'spreadsheet-tax-app', 'app.json');
    const pkg = path.join(root, 'mobile', 'spreadsheet-tax-app', 'package.json');
    const readme = path.join(root, 'mobile', 'README.md');
    for (const f of [appJs, appJson, pkg, readme]) {
      assert.ok(fs.existsSync(f), `missing ${f}`);
    }
    const js = fs.readFileSync(appJs, 'utf8');
    assert.match(js, /\/app|PATH_APP/);
    assert.match(js, /\/portal|PATH_PORTAL/);
    assert.match(js, /WebView|react-native-webview/);
    assert.match(js, /spreadsheet-tax-production\.up\.railway\.app|EXPO_PUBLIC_PRODUCT_URL/);
    const conf = JSON.parse(fs.readFileSync(appJson, 'utf8'));
    assert.ok(conf.expo.ios.bundleIdentifier);
    assert.ok(conf.expo.android.package);
    const md = fs.readFileSync(readme, 'utf8');
    assert.match(md, /npm run ios|expo start --ios/i);
    assert.match(md, /npm run android|expo start --android/i);
  });
});

describe('practice-store real module', () => {
  it('lists firms and clients from shipped store', async () => {
    const {
      listFirms,
      listClientsForFirm,
      ensureDemoData,
    } = await import('../src/lib/practice-store.js');
    ensureDemoData();
    const firms = listFirms();
    assert.ok(firms.length >= 2);
    const clients = listClientsForFirm({ firmId: firms[0].id });
    assert.ok(Array.isArray(clients));
  });
});
