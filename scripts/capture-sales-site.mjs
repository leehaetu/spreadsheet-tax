/**
 * Full sales-site visual capture (desktop + mobile, fold/full/scroll stages).
 * Usage:
 *   BASE_URL=http://127.0.0.1:3456 node scripts/capture-sales-site.mjs
 *   OUT_DIR=docs/audits/2026-07-18-sales-site-review/after node scripts/capture-sales-site.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3456';
const OUT =
  process.env.OUT_DIR ||
  path.join(root, 'docs/audits/2026-07-18-sales-site-review/after/screenshots');
const INDEX_PATH =
  process.env.INDEX_PATH ||
  path.join(path.dirname(OUT), 'capture-index.json');

const ROUTES = [
  { slug: '01-home-sales', path: '/' },
  { slug: '02-self-employed', path: '/self-employed' },
  { slug: '03-landlords', path: '/landlords' },
  { slug: '04-professionals', path: '/professionals' },
  { slug: '05-firms', path: '/firms' },
  { slug: '06-how-it-works', path: '/how-it-works' },
  { slug: '07-pricing', path: '/pricing' },
  { slug: '08-templates', path: '/templates' },
  { slug: '09-security', path: '/security' },
  { slug: '10-help', path: '/help' },
  { slug: '11-license', path: '/license' },
  { slug: '12-legal', path: '/legal' },
  { slug: '13-privacy', path: '/privacy' },
  { slug: '14-terms', path: '/terms' },
  { slug: '15-signin', path: '/signin' },
  { slug: '16-register', path: '/register' },
  { slug: '17-forgot-password', path: '/forgot-password' },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

fs.mkdirSync(OUT, { recursive: true });

async function pageMetrics(page) {
  return page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const texts = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let n;
    let small = 0;
    let minFont = 99;
    while ((n = walk.nextNode()) && texts.length < 14) {
      const t = (n.childNodes.length === 1 && n.childNodes[0].nodeType === 3
        ? n.textContent
        : ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      if (!t || t.length > 90) continue;
      const s = getComputedStyle(n);
      const fsPx = parseFloat(s.fontSize) || 0;
      if (fsPx && fsPx < minFont) minFont = fsPx;
      if (fsPx && fsPx < 12) small++;
      texts.push(`${n.tagName}@${fsPx}px ${s.color} ${t.slice(0, 70)}`);
    }
    const header = document.querySelector('header[data-sales-nav], .site-header');
    const modePill = !!document.getElementById('st-mode-pill');
    const salesNav = header?.getAttribute('data-sales-nav') || null;
    const hamburger = !!document.querySelector('.sales-nav-toggle');
    const drawerHidden = document.querySelector('#sales-nav-drawer')?.hasAttribute('hidden');
    const lead = document.querySelector('.hero .lead, .audience-hero .lead, main .lead');
    let leadColor = null;
    let leadFont = null;
    if (lead) {
      const lcs = getComputedStyle(lead);
      leadColor = lcs.color;
      leadFont = lcs.fontSize;
    }
    const eyebrow = document.querySelector('.eyebrow');
    let eyebrowFont = null;
    if (eyebrow) eyebrowFont = getComputedStyle(eyebrow).fontSize;
    const ctas = [...document.querySelectorAll('a.btn, button.btn')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20);
    const nav = [...document.querySelectorAll('header nav a, .sales-nav-desktop a, .sales-nav-drawer a')]
      .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return {
      title: document.title,
      scrollHeight: document.documentElement.scrollHeight,
      bodyBg: cs.backgroundColor,
      bodyColor: cs.color,
      fontFamily: cs.fontFamily,
      headings: [...document.querySelectorAll('h1, h2')]
        .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 12),
      ctas,
      nav,
      minFont: minFont === 99 ? null : minFont,
      smallTextCount: small,
      sampleTexts: texts,
      salesNav,
      modePill,
      hamburger,
      drawerHidden,
      leadColor,
      leadFont,
      eyebrowFont,
      hasGetStartedFree: ctas.some((c) => c === 'Get started free'),
      hasCreateFreeAccount: ctas.some((c) => /Create free account/i.test(c)),
      hasPreviewOnly: (document.body.innerText || '').includes('Preview only'),
    };
  });
}

async function captureRoute(browser, route, vpName, vp) {
  const context = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const url = BASE.replace(/\/$/, '') + route.path;
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  // Allow sales-chrome + site-chrome to boot
  await page.waitForTimeout(400);
  const status = res?.status() || 0;
  const metrics = await pageMetrics(page);
  const h = metrics.scrollHeight || vp.height;
  const prefix = `${route.slug}-${vpName}`;

  await page.screenshot({
    path: path.join(OUT, `${prefix}-full.png`),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(OUT, `${prefix}-fold.png`),
    fullPage: false,
  });

  const stages = ['top'];
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(OUT, `${prefix}-scroll-top.png`),
    fullPage: false,
  });

  if (h > vp.height * 1.35) {
    stages.push('mid', 'bottom');
    await page.evaluate((hh) => window.scrollTo(0, Math.floor(hh * 0.45)), h);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(OUT, `${prefix}-scroll-mid.png`),
      fullPage: false,
    });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: path.join(OUT, `${prefix}-scroll-bottom.png`),
      fullPage: false,
    });
  }

  await context.close();
  return {
    slug: route.slug,
    path: route.path,
    viewport: vpName,
    status,
    file: `${prefix}-full.png`,
    height: h,
    stages,
    metrics,
  };
}

async function captureAppReview(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  // App requires auth — use sample path on public app if redirected
  let res = await page.goto(BASE.replace(/\/$/, '') + '/app', {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  // If signed out, app may redirect — try register path then stay on marketing how-it-works embed
  const url = page.url();
  const shotPath = path.join(OUT, '18-app-review-desktop-fold.png');
  if (url.includes('signin') || url.includes('register')) {
    // Capture how-it-works as product process illustration instead of inventing login
    await page.goto(BASE.replace(/\/$/, '') + '/how-it-works', {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: shotPath, fullPage: false });
    await context.close();
    return { file: path.basename(shotPath), note: 'how-it-works fold (app signed-out)' };
  }
  const sample = page.locator('.sample-btn').first();
  if (await sample.count()) {
    await sample.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: shotPath, fullPage: false });
  await context.close();
  return { file: path.basename(shotPath), note: 'app review fold', status: res?.status() };
}

const browser = await chromium.launch({ headless: true });
const index = [];
try {
  // Health check
  const probe = await fetch(BASE);
  if (!probe.ok && probe.status !== 200) {
    console.error('BASE_URL not healthy', BASE, probe.status);
    process.exit(1);
  }
  for (const route of ROUTES) {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const row = await captureRoute(browser, route, vpName, vp);
      index.push(row);
      console.log(row.status, row.viewport, row.path, 'nav=', row.metrics.salesNav, 'pill=', row.metrics.modePill);
    }
  }
  const appShot = await captureAppReview(browser);
  console.log('app/how-it-works shot', appShot);
  fs.writeFileSync(INDEX_PATH, JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, index, appShot }, null, 2));
  console.log('Wrote', INDEX_PATH, 'entries', index.length, 'dir', OUT);
} finally {
  await browser.close();
}
