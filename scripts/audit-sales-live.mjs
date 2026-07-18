/**
 * Live sales-site visual + interaction audit.
 * Captures every public sales route at desktop/mobile, clicks primary buttons,
 * writes screenshots + a defects JSON for human/agent review.
 *
 * Usage:
 *   BASE_URL=https://spreadsheet-tax-production.up.railway.app node scripts/audit-sales-live.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = (process.env.BASE_URL || 'https://spreadsheet-tax-production.up.railway.app').replace(/\/$/, '');
const OUT = process.env.OUT_DIR || path.join(root, 'docs/audits/sales-live-audit');
const shotDir = path.join(OUT, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });

const ROUTES = [
  '/',
  '/self-employed',
  '/landlords',
  '/professionals',
  '/firms',
  '/how-it-works',
  '/pricing',
  '/templates',
  '/security',
  '/help',
  '/license',
  '/legal',
  '/privacy',
  '/terms',
  '/signin',
  '/register',
  '/forgot-password',
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** @type {object[]} */
const defects = [];
/** @type {object[]} */
const pages = [];

function note(severity, route, viewport, issue, detail = {}) {
  defects.push({ severity, route, viewport, issue, ...detail, at: new Date().toISOString() });
}

async function inspectPage(page, route, vpName) {
  const metrics = await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const header = document.querySelector('header[data-sales-nav], .site-header');
    const salesNav = header?.getAttribute('data-sales-nav') || null;
    const modePill = !!document.getElementById('st-mode-pill');
    const toggle = document.querySelector('.sales-nav-toggle');
    const toggleDisplay = toggle ? getComputedStyle(toggle).display : null;
    const drawer = document.querySelector('#sales-nav-drawer');
    const brokenImgs = [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src);
    const h1 = document.querySelector('h1')?.textContent?.trim() || null;
    const title = document.title;
    const ctas = [...document.querySelectorAll('a.btn, button.btn')]
      .map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href'),
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      }))
      .filter((c) => c.text);
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter(Boolean);
    const createFree = ctas.filter((c) => /create free account/i.test(c.text));
    const getStarted = ctas.filter((c) => /get started free/i.test(c.text));
    const lead = document.querySelector('.hero .lead, .audience-hero .lead, main .lead');
    const leadColor = lead ? getComputedStyle(lead).color : null;
    const bodyBg = cs.backgroundColor;
    const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
    return {
      title,
      h1,
      salesNav,
      modePill,
      toggleDisplay,
      drawerHidden: drawer?.hasAttribute('hidden') ?? null,
      brokenImgs,
      ctas,
      createFreeCount: createFree.length,
      getStartedCount: getStarted.length,
      leadColor,
      bodyBg,
      overflowX,
      linkCount: links.length,
      internalHrefs: links.filter((h) => h.startsWith('/') || h.includes(location.host)),
    };
  });

  if (metrics.modePill) note('P0', route, vpName, 'Mode pill visible on sales/auth surface');
  if (metrics.createFreeCount > 0) note('P0', route, vpName, 'Create free account CTA still present', { count: metrics.createFreeCount });
  if (metrics.brokenImgs.length) note('P0', route, vpName, 'Broken images', { srcs: metrics.brokenImgs });
  if (!metrics.h1) note('P1', route, vpName, 'Missing H1');
  if (metrics.overflowX) note('P1', route, vpName, 'Horizontal overflow (layout blowout)');
  if (vpName === 'mobile' && metrics.toggleDisplay === 'none') {
    note('P1', route, vpName, 'Mobile hamburger not visible');
  }
  if (vpName === 'desktop' && metrics.salesNav !== 'v1') {
    // chrome may not have run yet — already waited; still note
    note('P1', route, vpName, 'sales-chrome data-sales-nav missing after load', { salesNav: metrics.salesNav });
  }
  // dark forgot password
  if (route === '/forgot-password') {
    const m = metrics.bodyBg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const [, r, g, b] = m.map(Number);
      if (r + g + b < 120) note('P0', route, vpName, 'Forgot-password still dark theme', { bodyBg: metrics.bodyBg });
    }
  }

  return metrics;
}

async function clickAudit(page, route, vpName) {
  // Primary CTAs that should navigate or act
  const clicks = [];
  const candidates = page.locator('a.btn-primary, button.btn-primary, a.btn.btn-primary');
  const n = await candidates.count();
  for (let i = 0; i < Math.min(n, 6); i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const text = ((await el.textContent()) || '').replace(/\s+/g, ' ').trim();
    const href = await el.getAttribute('href');
    clicks.push({ text, href, ok: true });
    // Don't navigate away for every CTA — only verify href is valid path or http
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      // HEAD-like via evaluate fetch
      const status = await page.evaluate(async (h) => {
        try {
          const r = await fetch(h, { method: 'GET', redirect: 'manual' });
          return r.status;
        } catch (e) {
          return -1;
        }
      }, href);
      if (status >= 400 || status === -1) {
        note('P0', route, vpName, `Primary CTA href fails`, { text, href, status });
        clicks[clicks.length - 1].ok = false;
        clicks[clicks.length - 1].status = status;
      } else {
        clicks[clicks.length - 1].status = status;
      }
    }
  }

  // Mobile: open hamburger if present
  if (vpName === 'mobile') {
    const toggle = page.locator('.sales-nav-toggle');
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(200);
      await page.screenshot({
        path: path.join(shotDir, `${routeSlug(route)}-${vpName}-menu-open.png`),
        fullPage: false,
      });
      const drawerVisible = await page.locator('#sales-nav-drawer').isVisible().catch(() => false);
      if (!drawerVisible) note('P0', route, vpName, 'Hamburger open but drawer not visible');
      // close
      await page.keyboard.press('Escape');
    }
  }

  return clicks;
}

function routeSlug(route) {
  return route === '/' ? '00-home' : route.replace(/^\//, '').replace(/\//g, '-');
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const url = BASE + route;
      let status = 0;
      try {
        const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        status = res?.status() || 0;
      } catch (e) {
        note('P0', route, vpName, 'Navigation failed', { error: String(e.message || e) });
        await context.close();
        continue;
      }
      await page.waitForTimeout(500);
      if (status !== 200) note('P0', route, vpName, `HTTP ${status}`);

      const slug = routeSlug(route);
      await page.screenshot({
        path: path.join(shotDir, `${slug}-${vpName}-fold.png`),
        fullPage: false,
      });
      await page.screenshot({
        path: path.join(shotDir, `${slug}-${vpName}-full.png`),
        fullPage: true,
      });

      const metrics = await inspectPage(page, route, vpName);
      const clicks = await clickAudit(page, route, vpName);

      pages.push({ route, viewport: vpName, status, metrics, clicks });
      console.log(status, vpName, route, 'ctas', metrics.ctas.length, 'defects so far', defects.length);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

// Sort defects P0 first
defects.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'P0' ? -1 : 1));

const report = {
  base: BASE,
  capturedAt: new Date().toISOString(),
  pageCount: pages.length,
  defectCount: defects.length,
  p0: defects.filter((d) => d.severity === 'P0').length,
  p1: defects.filter((d) => d.severity === 'P1').length,
  defects,
  pages: pages.map((p) => ({
    route: p.route,
    viewport: p.viewport,
    status: p.status,
    h1: p.metrics.h1,
    salesNav: p.metrics.salesNav,
    getStarted: p.metrics.getStartedCount,
    createFree: p.metrics.createFreeCount,
    brokenImgs: p.metrics.brokenImgs,
    overflowX: p.metrics.overflowX,
    clicks: p.clicks,
  })),
};

fs.writeFileSync(path.join(OUT, 'defects.json'), JSON.stringify(report, null, 2));

// Markdown report
const md = [
  `# Live sales audit`,
  ``,
  `**Base:** ${BASE}`,
  `**When:** ${report.capturedAt}`,
  `**Pages:** ${report.pageCount}`,
  `**Defects:** ${report.defectCount} (P0: ${report.p0}, P1: ${report.p1})`,
  ``,
  `## P0 defects`,
  ``,
  ...(report.p0
    ? defects.filter((d) => d.severity === 'P0').map((d) => `- **${d.route}** (${d.viewport}): ${d.issue}${d.href ? ` \`${d.href}\`` : ''}${d.status != null ? ` status=${d.status}` : ''}`)
    : ['- None recorded']),
  ``,
  `## P1 defects`,
  ``,
  ...(report.p1
    ? defects.filter((d) => d.severity === 'P1').map((d) => `- **${d.route}** (${d.viewport}): ${d.issue}`)
    : ['- None recorded']),
  ``,
  `## Screenshots`,
  ``,
  `Folder: \`${path.relative(root, shotDir)}\``,
  ``,
];
fs.writeFileSync(path.join(OUT, 'AUDIT.md'), md.join('\n'));
console.log('Wrote', path.join(OUT, 'AUDIT.md'), 'defects', report.defectCount);
process.exit(report.p0 > 0 ? 2 : 0);
