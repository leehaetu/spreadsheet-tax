/**
 * Capture a clean marketing product shot for public/images/app-review-fold.png
 * - Signs in as demo user
 * - Dismisses cookie banner + removes mode pills
 * - Loads first sample into review
 * - Crops to review panel (no dual chrome)
 *
 * Usage: BASE_URL=http://127.0.0.1:3456 node scripts/capture-app-review-marketing.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3456').replace(/\/$/, '');
const OUT = process.env.OUT || path.join(root, 'public/images/app-review-fold.png');

async function stripChrome(page) {
  await page.evaluate(() => {
    document.getElementById('cookie-banner')?.remove();
    document.querySelectorAll('.st-mode-pill, #st-mode-pill').forEach((el) => el.remove());
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('st_cookie_ok', '1');
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${BASE}/signin?next=/app`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('#email', process.env.DEMO_EMAIL || 'demo@spreadsheet-tax.example');
  await page.fill('#password', process.env.DEMO_PASSWORD || 'DemoPass123!');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);

  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(1000);
  await stripChrome(page);

  if (await page.locator('#samples').count()) {
    await page.locator('#samples').evaluate((el) => {
      el.open = true;
    });
    const btn = page.locator('.sample-btn').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(2500);
    }
  }

  await page.locator('#review-panel').waitFor({ state: 'visible', timeout: 15_000 });
  await stripChrome(page);

  // Clip to review panel, clamped to viewport
  const box = await page.locator('#review-panel').boundingBox();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (box) {
    const x = Math.max(0, Math.floor(box.x));
    const y = Math.max(0, Math.floor(box.y));
    const width = Math.min(1400, Math.floor(box.width));
    const height = Math.min(820, Math.floor(Math.min(box.height, 900 - y)));
    await page.screenshot({
      path: OUT,
      clip: { x, y, width: Math.max(400, width), height: Math.max(300, height) },
      animations: 'disabled',
    });
  } else {
    await page.locator('#review-panel').screenshot({ path: OUT, animations: 'disabled' });
  }

  const stat = fs.statSync(OUT);
  const text = await page.locator('#review-panel').innerText();
  if (!text.includes('£')) {
    throw new Error('Review panel missing figures (£) — marketing shot incomplete');
  }
  console.log(JSON.stringify({ ok: true, out: OUT, bytes: stat.size, hasFigures: true }));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
