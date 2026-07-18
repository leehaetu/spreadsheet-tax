/**
 * Real HMRC sandbox: SA Assist generate + acknowledge.
 * Evidence: docs/hmrc/sa-assist-sandbox-run.json
 *
 *   RUN_HMRC_SANDBOX_E2E=1 node scripts/hmrc-sa-assist-sandbox-run.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE =
  process.env.BASE_URL || 'https://spreadsheet-tax-production.up.railway.app';
const CLIENT_ID = process.env.HMRC_CLIENT_ID || '7jXz9nloyX2CBs1FTmlghl84vcpX';
const DEMO_EMAIL = process.env.ST_DEMO_EMAIL || 'demo@spreadsheet-tax.example';
const DEMO_PASS = process.env.ST_DEMO_PASSWORD || 'DemoPass123!';
const TEST_USER = process.env.HMRC_SANDBOX_TEST_USER_ID || '316759042367';
const TEST_PASS = process.env.HMRC_SANDBOX_TEST_USER_PASSWORD || 'ugsesjaAyhu4';
const NINO = (process.env.HMRC_SANDBOX_TEST_NINO || 'TB116925D')
  .replace(/\s+/g, '')
  .toUpperCase();
const CALC_WITH_MESSAGES =
  process.env.HMRC_ASSIST_CALC_ID || 'f2fb30e5-4ab6-4a29-b3c1-c7264259ff1c';
const CALC_NO_MESSAGES = '620490b4-06e3-4fef-a555-6fd0877dc7ca';
const TAX_YEAR = process.env.HMRC_ASSIST_TAX_YEAR || '2025-26';

const evidence = {
  at: new Date().toISOString(),
  base: BASE,
  api: 'Self Assessment Assist (MTD) 1.0',
  nino: NINO.slice(0, 2) + '****',
  taxYear: TAX_YEAR,
  calculationIdMessages: CALC_WITH_MESSAGES,
  calculationIdEmpty: CALC_NO_MESSAGES,
  steps: [],
};

function step(name, data) {
  const hmrcStatus = Number(
    data?.hmrcStatus ?? data?.status ?? data?.httpStatus ?? null
  );
  const ok =
    Number.isFinite(hmrcStatus) && hmrcStatus >= 200 && hmrcStatus < 300;
  const entry = {
    name,
    ok,
    hmrcStatus: Number.isFinite(hmrcStatus) ? hmrcStatus : null,
    path: data?.path || null,
    reportId: data?.body?.reportId || data?.reportId || null,
    correlationId:
      data?.correlationId ||
      data?.body?.correlationId ||
      data?.responseHeaders?.['x-correlationid'] ||
      null,
    messageCount: Array.isArray(data?.body?.messages)
      ? data.body.messages.length
      : null,
    // Store exact HMRC message fields only (no paraphrasing) for ledger proof
    messages: Array.isArray(data?.body?.messages)
      ? data.body.messages.map((m) => ({
          title: m?.title ?? null,
          body: m?.body ?? null,
          action: m?.action ?? null,
          path: m?.path ?? null,
          links: m?.links ?? null,
        }))
      : null,
    hmrcCode:
      data?.body?.code ||
      (Array.isArray(data?.body) && data.body[0]?.code) ||
      data?.hmrcCode ||
      null,
    snippet: JSON.stringify(data?.body ?? data ?? {}).slice(0, 800),
  };
  evidence.steps.push(entry);
  console.log(
    JSON.stringify({
      step: name,
      ok: entry.ok,
      hmrcStatus: entry.hmrcStatus,
      hmrcCode: entry.hmrcCode,
      reportId: entry.reportId,
      correlationId: entry.correlationId,
      messageCount: entry.messageCount,
    })
  );
  return entry;
}

async function productLogin(page) {
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(DEMO_EMAIL);
  await page.locator('#password').fill(DEMO_PASS);
  await page.locator('button[type=submit]').click();
  await page.waitForTimeout(1500);
}

/** Same pattern as tests/e2e/hmrc-mtd-full-journey.spec.js */
async function hmrcOauth(page) {
  await page.goto(`${BASE}/connect-hmrc`, { waitUntil: 'domcontentloaded' });
  await page.locator('#connect-individual-btn').click();
  await page.waitForURL(/test-www\.tax\.service\.gov\.uk/, { timeout: 45_000 });

  const acc = page.getByRole('button', { name: /accept additional cookies/i });
  if (await acc.isVisible().catch(() => false)) await acc.click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForTimeout(1200);

  const signIn = page.locator('a', { hasText: /Sign in to the HMRC online service/i });
  await signIn.first().waitFor({ timeout: 15_000 });
  await signIn.first().click();
  await page.waitForTimeout(1500);

  if (!(await page.locator('#userId').isVisible().catch(() => false))) {
    const u = page.url();
    const m = u.match(/auth_id=([^&]+)/);
    const s = u.match(/state=([^&]+)/);
    if (m && s) {
      await page.goto(
        `https://test-www.tax.service.gov.uk/api-test-login/sign-in?continue=${encodeURIComponent(
          `/oauth/grantscope?auth_id=${m[1]}&state=${s[1]}`
        )}&origin=oauth-frontend&clientId=${CLIENT_ID}`
      );
    }
  }

  await page.locator('#userId').waitFor({ timeout: 20_000 });
  await page.locator('#userId').fill(TEST_USER);
  await page.locator('#password').fill(TEST_PASS);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page
    .getByRole('button', { name: /give permission/i })
    .waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: /give permission/i }).click();
  await page.waitForURL(/spreadsheet-tax-production\.up\.railway\.app/, {
    timeout: 60_000,
  });
}

async function apiPost(page, urlPath, body) {
  return page.evaluate(
    async ({ urlPath, body }) => {
      const res = await fetch(urlPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text.slice(0, 500) };
      }
      return {
        httpStatus: res.status,
        ...json,
        status: json?.status ?? json?.hmrcStatus ?? res.status,
      };
    },
    { urlPath, body }
  );
}

async function main() {
  if (process.env.RUN_HMRC_SANDBOX_E2E !== '1') {
    console.error('Set RUN_HMRC_SANDBOX_E2E=1 to run real HMRC sandbox Assist calls.');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await productLogin(page);
    step('product_login', { status: 200, path: '/api/auth/login' });

    await hmrcOauth(page);
    const st = await page.evaluate(async () => {
      const r = await fetch('/api/hmrc/status');
      return r.json();
    });
    const connected = Boolean(st.connection?.connected && !st.connection?.mock);
    step('oauth_status', {
      status: connected ? 200 : 400,
      path: '/api/hmrc/status',
      body: {
        connected: st.connection?.connected,
        mock: st.connection?.mock,
        mode: st.connection?.mode,
      },
    });
    if (!connected) {
      throw new Error('HMRC OAuth not connected after grant');
    }

    const reportRes = await apiPost(page, '/api/hmrc/mtd/assist/report', {
      nino: NINO,
      taxYear: TAX_YEAR,
      calculationId: CALC_WITH_MESSAGES,
    });
    const reportStep = step('sa_assist_generate_report', {
      ...reportRes,
      hmrcStatus: reportRes.status ?? reportRes.hmrcStatus ?? reportRes.httpStatus,
      path: `/individuals/self-assessment/assist/reports/${NINO}/${TAX_YEAR}/${CALC_WITH_MESSAGES}`,
    });

    const emptyRes = await apiPost(page, '/api/hmrc/mtd/assist/report', {
      nino: NINO,
      taxYear: TAX_YEAR,
      calculationId: CALC_NO_MESSAGES,
    });
    step('sa_assist_generate_report_204', {
      ...emptyRes,
      hmrcStatus: emptyRes.status ?? emptyRes.hmrcStatus ?? emptyRes.httpStatus,
      path: `/individuals/self-assessment/assist/reports/${NINO}/${TAX_YEAR}/${CALC_NO_MESSAGES}`,
    });

    const reportId =
      reportRes.body?.reportId || reportRes.reportId || reportStep.reportId;
    const correlationId =
      reportRes.body?.correlationId ||
      reportRes.correlationId ||
      reportStep.correlationId;

    if (reportId && correlationId) {
      const ackRes = await apiPost(page, '/api/hmrc/mtd/assist/acknowledge', {
        nino: NINO,
        reportId,
        correlationId,
      });
      step('sa_assist_acknowledge', {
        ...ackRes,
        hmrcStatus: ackRes.status ?? ackRes.hmrcStatus ?? ackRes.httpStatus,
        path: `/individuals/self-assessment/assist/reports/acknowledge/${NINO}/${reportId}/${String(correlationId).slice(0, 16)}…`,
        reportId,
        correlationId,
      });
    } else {
      step('sa_assist_acknowledge', {
        status: 0,
        body: {
          error: 'Missing reportId/correlationId from generate response',
          snippet: JSON.stringify(reportRes).slice(0, 500),
        },
      });
    }

    const true2xx = evidence.steps.filter((s) => s.ok).length;
    const failed = evidence.steps.filter((s) => !s.ok).length;
    evidence.summary = {
      true2xx,
      failed,
      total: evidence.steps.length,
      generateOk: reportStep.ok,
      messageCount: reportStep.messageCount,
      reportId: reportStep.reportId,
      correlationId: reportStep.correlationId,
      tag: reportStep.ok ? 'SANDBOX_HTTP' : 'FAIL',
    };
  } finally {
    await browser.close();
  }

  const outPath = path.join(root, 'docs/hmrc/sa-assist-sandbox-run.json');
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2));
  console.log('Wrote', outPath);
  console.log('SUMMARY', evidence.summary);
  if (!evidence.summary?.generateOk) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  evidence.steps.push({
    name: 'fatal',
    ok: false,
    hmrcStatus: null,
    snippet: String(e?.stack || e),
  });
  fs.writeFileSync(
    path.join(root, 'docs/hmrc/sa-assist-sandbox-run.json'),
    JSON.stringify(evidence, null, 2)
  );
  process.exit(1);
});
