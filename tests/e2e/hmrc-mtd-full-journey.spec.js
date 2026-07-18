/**
 * Full P1–P3 sandbox journey against production Spreadsheet Tax + HMRC sandbox.
 * Generates real HMRC API traffic (they log it; we do not email logs).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE =
  process.env.BASE_URL ||
  'https://spreadsheet-tax-production.up.railway.app';
const CLIENT_ID = process.env.HMRC_CLIENT_ID || '7jXz9nloyX2CBs1FTmlghl84vcpX';
const TEST_USER = process.env.HMRC_SANDBOX_TEST_USER_ID || '316759042367';
const TEST_PASS = process.env.HMRC_SANDBOX_TEST_USER_PASSWORD || 'ugsesjaAyhu4';
const NINO = process.env.HMRC_SANDBOX_TEST_NINO || 'TB116925D';
const DEMO_EMAIL = process.env.ST_DEMO_EMAIL || 'demo@spreadsheet-tax.example';
const DEMO_PASS = process.env.ST_DEMO_PASSWORD || 'DemoPass123!';
const RUN_REAL_SANDBOX = process.env.RUN_HMRC_SANDBOX_E2E === '1';

const evidence = {
  at: new Date().toISOString(),
  base: BASE,
  nino: NINO.slice(0, 2) + '****',
  steps: [],
};

function logStep(name, data) {
  // Honest scoring: only HMRC 2xx (or true double/preview) count as success.
  // App may wrap HMRC 4xx/5xx as product 502 with body.status — use HMRC status when present.
  const hmrcStatus =
    data?.body?.status ??
    data?.response?.status ??
    data?.hmrcStatus ??
    data?.status ??
    data?.httpStatus ??
    null;
  const statusNum = Number(hmrcStatus);
  const trueHttpOk =
    Number.isFinite(statusNum) && statusNum >= 200 && statusNum < 300;
  // Explicit validation / throttle failures are never "ok"
  const code =
    data?.body?.body?.code ||
    data?.body?.code ||
    data?.validationCode ||
    data?.body?.validationCode ||
    null;
  const forcedFail =
    code === 'MESSAGE_THROTTLED_OUT' ||
    code === 'INVALID_HEADERS' ||
    data?.ok === 'INVALID_HEADERS' ||
    data?.ok === false;
  const ok = forcedFail ? false : trueHttpOk;
  evidence.steps.push({
    name,
    ok,
    status: statusNum || hmrcStatus,
    hmrcCode: code,
    label: data?.label || null,
    path: data?.path || data?.body?.path || null,
    snippet: JSON.stringify(data?.body || data?.response || data || {}).slice(
      0,
      400
    ),
  });
}

async function productLogin(page) {
  await page.goto(`${BASE}/signin`);
  await page.locator('#email, input[type="email"], input[name="email"]').first().fill(DEMO_EMAIL);
  await page.locator('#password, input[type="password"]').first().fill(DEMO_PASS);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForTimeout(1200);
}

async function hmrcOauth(page) {
  await page.goto(`${BASE}/connect-hmrc`);
  await expect(page.getByRole('heading', { name: 'Connect HMRC' })).toBeVisible({
    timeout: 20_000,
  });
  await page.locator('#connect-individual-btn').click();
  await page.waitForURL(/test-www\.tax\.service\.gov\.uk/, { timeout: 45_000 });

  const acc = page.getByRole('button', { name: /accept additional cookies/i });
  if (await acc.isVisible().catch(() => false)) await acc.click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForTimeout(1200);

  const signIn = page.locator('a', { hasText: /Sign in to the HMRC online service/i });
  await expect(signIn.first()).toBeVisible({ timeout: 15_000 });
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

  await expect(page.locator('#userId')).toBeVisible({ timeout: 20_000 });
  await page.locator('#userId').fill(TEST_USER);
  await page.locator('#password').fill(TEST_PASS);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('button', { name: /give permission/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: /give permission/i }).click();
  await page.waitForURL(/spreadsheet-tax-production\.up\.railway\.app/, {
    timeout: 60_000,
  });
}

test.describe('Full MTD sandbox journey (operator)', () => {
  test.skip(!RUN_REAL_SANDBOX, 'Set RUN_HMRC_SANDBOX_E2E=1 for operator-run external HMRC evidence.');
  test.setTimeout(300_000);

  test('OAuth + P1 periods + P2/P3 probes', async ({ page }) => {
    await productLogin(page);
    await hmrcOauth(page);

    const st = await page.evaluate(async () => {
      const r = await fetch('/api/hmrc/status');
      return r.json();
    });
    expect(st.connection?.connected).toBe(true);
    expect(st.connection?.mock).toBe(false);
    logStep('oauth_status', { ok: true, status: 200, body: st.connection });

    // Import samples → drafts
    const drafts = {};
    for (const sample of ['self_employment', 'uk_property', 'foreign_property']) {
      const imp = await page.evaluate(async (s) => {
        const r = await fetch('/api/import/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample: s }),
        });
        return { status: r.status, body: await r.json() };
      }, sample);
      logStep(`import_${sample}`, {
        ok: imp.status === 200 && Boolean(imp.body?.draftId),
        status: imp.status,
        body: { draftId: imp.body?.draftId },
      });
      drafts[sample] = imp.body?.draftId;
    }

    // Ensure property businesses exist (SA Test Support) — use returned businessIds
    let bidUk = '';
    let bidFp = '';
    const idsPath = path.join(process.cwd(), 'docs', 'hmrc', 'sandbox-business-ids.json');
    let cached = {};
    try {
      cached = JSON.parse(fs.readFileSync(idsPath, 'utf8'));
    } catch {
      cached = {};
    }
    bidUk = cached.uk || '';
    bidFp = cached.foreign || '';

    // Ensure property businesses: create-or-list. RULE_PROPERTY_BUSINESS_ADDED is NOT success.
    const ensured = await page.evaluate(async (n) => {
      const r = await fetch('/api/hmrc/mtd/ensure-property-businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nino: n }),
      });
      return { status: r.status, body: await r.json() };
    }, NINO);
    const ensuredBody = ensured.body?.body || ensured.body || {};
    for (const step of ensuredBody.steps || []) {
      logStep(step.step || 'ensure_step', {
        ok: Boolean(step.ok),
        status: step.status,
        body: step,
        path: step.step,
      });
    }
    logStep('ensure_property_businesses', {
      ok: Boolean(ensuredBody.ok || ensured.body?.ok),
      status: ensured.status,
      body: ensuredBody,
    });
    if (ensuredBody.uk) bidUk = ensuredBody.uk;
    if (ensuredBody.foreign) bidFp = ensuredBody.foreign;

    // Businesses
    const businesses = await page.evaluate(async (n) => {
      const r = await fetch(`/api/hmrc/mtd/businesses?nino=${encodeURIComponent(n)}`);
      return { status: r.status, body: await r.json() };
    }, NINO);
    logStep('businesses', {
      ok: businesses.body?.ok,
      status: businesses.status,
      body: businesses.body?.body || businesses.body,
      path: businesses.body?.path,
    });

    const list =
      businesses.body?.body?.listOfBusinesses ||
      businesses.body?.body?.businesses ||
      [];
    let bidSe = ensuredBody.se || '';
    const nonSe = [];
    for (const row of Array.isArray(list) ? list : []) {
      const id = row.businessId || row.id || '';
      const t = String(row.typeOfBusiness || row.type || '').toLowerCase();
      if (t.includes('self')) bidSe = id;
      else if (id) {
        nonSe.push({ id, t });
        if ((t.includes('uk') || t.includes('property')) && !t.includes('foreign') && !bidUk)
          bidUk = id;
        if (t.includes('foreign') && !bidFp) bidFp = id;
      }
    }
    // If list omits types but we have extra IDs, assign by position
    if (!bidUk && nonSe[0]) bidUk = nonSe[0].id;
    if (!bidFp && nonSe[1]) bidFp = nonSe[1].id;
    if (!bidSe && list[0]) bidSe = list[0].businessId || list[0].id || '';

    // Persist for next runs when create returns ALREADY_ADDED without id
    try {
      fs.writeFileSync(
        idsPath,
        JSON.stringify(
          { uk: bidUk, foreign: bidFp, se: bidSe, updatedAt: new Date().toISOString() },
          null,
          2
        )
      );
    } catch {
      /* ignore */
    }

    // Obligations
    const obl = await page.evaluate(async (n) => {
      const r = await fetch(`/api/hmrc/mtd/obligations/ie?nino=${encodeURIComponent(n)}`);
      return { status: r.status, body: await r.json() };
    }, NINO);
    logStep('obligations_ie', {
      ok: obl.status === 200 || obl.status === 502,
      status: obl.status,
      body: obl.body,
      path: obl.body?.path,
    });

    // SE period from draft
    if (bidSe && drafts.self_employment) {
      const se = await page.evaluate(
        async ({ n, bid, draftId }) => {
          const r = await fetch('/api/hmrc/mtd/period/se', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nino: n, businessId: bid, draftId }),
          });
          return { status: r.status, body: await r.json() };
        },
        { n: NINO, bid: bidSe, draftId: drafts.self_employment }
      );
      logStep('se_period_create', {
        ok: se.body?.ok || se.status === 200,
        status: se.status,
        body: se.body,
        path: se.body?.path,
        label: se.body?.label,
      });
      const periodId = se.body?.body?.periodId || se.body?.response?.periodId;
      if (periodId) {
        const get = await page.evaluate(
          async ({ n, bid, periodId }) => {
            const r = await fetch(
              `/api/hmrc/mtd/period/se/${encodeURIComponent(bid)}/${encodeURIComponent(periodId)}?nino=${encodeURIComponent(n)}`
            );
            return { status: r.status, body: await r.json() };
          },
          { n: NINO, bid: bidSe, periodId }
        );
        logStep('se_period_retrieve', {
          ok: get.body?.ok || get.status === 200,
          status: get.status,
          body: get.body,
          path: get.body?.path,
        });
      }
    } else {
      logStep('se_period_create', {
        ok: false,
        status: null,
        body: { error: 'missing businessId or draft' },
      });
    }

    // UK property — explicit HMRC-shaped body (also exercises draft path if present)
    if (bidUk) {
      const ukBody = {
        fromDate: '2024-04-06',
        toDate: '2024-07-05',
        ukOtherProperty: {
          income: { periodAmount: 7200 },
          expenses: { premisesRunningCosts: 420, repairsAndMaintenance: 100 },
        },
      };
      const uk = await page.evaluate(
        async ({ n, bid, periodBody }) => {
          const r = await fetch('/api/hmrc/mtd/period/uk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nino: n,
              businessId: bid,
              taxYear: '2024-25',
              body: periodBody,
            }),
          });
          return { status: r.status, body: await r.json() };
        },
        {
          n: NINO,
          bid: bidUk,
          periodBody: ukBody,
        }
      );
      logStep('uk_period_create', {
        ok: uk.body?.ok === true || uk.body?.status === 200,
        status: uk.status,
        body: uk.body,
        path: uk.body?.path,
      });
    } else {
      logStep('uk_period_create', {
        ok: false,
        status: null,
        body: { skip: true, reason: 'no uk business id' },
      });
    }

    // Foreign property
    if (bidFp) {
      const fpBody = {
        fromDate: '2024-04-06',
        toDate: '2024-07-05',
        foreignProperty: [
          {
            countryCode: 'ESP',
            income: {
              rentIncome: { rentAmount: 1500 },
              foreignTaxCreditRelief: false,
            },
            expenses: { premisesRunningCosts: 100 },
          },
        ],
      };
      const fp = await page.evaluate(
        async ({ n, bid, periodBody }) => {
          const r = await fetch('/api/hmrc/mtd/period/foreign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nino: n,
              businessId: bid,
              taxYear: '2024-25',
              body: periodBody,
            }),
          });
          return { status: r.status, body: await r.json() };
        },
        {
          n: NINO,
          bid: bidFp,
          periodBody: fpBody,
        }
      );
      logStep('fp_period_create', {
        ok: fp.body?.ok === true || fp.body?.status === 200,
        status: fp.status,
        body: fp.body,
        path: fp.body?.path,
      });
    } else {
      logStep('fp_period_create', {
        ok: false,
        status: null,
        body: { skip: true, reason: 'no foreign business id' },
      });
    }

    // Calcs
    const calc = await page.evaluate(async (n) => {
      const r = await fetch('/api/hmrc/mtd/calculations/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nino: n, taxYear: '2024-25', calculationType: 'in-year' }),
      });
      return { status: r.status, body: await r.json() };
    }, NINO);
    logStep('calc_trigger', {
      ok: calc.status === 200 || calc.status === 502,
      status: calc.status,
      body: calc.body,
      path: calc.body?.path,
    });

    // P2 probes
    const fd = await page.evaluate(async (n) => {
      const r = await fetch(
        `/api/hmrc/mtd/obligations/final-declaration?nino=${encodeURIComponent(n)}`
      );
      return { status: r.status, body: await r.json() };
    }, NINO);
    logStep('final_declaration_obligations', {
      ok: fd.status === 200 || fd.status === 502,
      status: fd.status,
      body: fd.body,
      path: fd.body?.path,
    });

    if (bidSe) {
      // Omit empty body — server resolveSeAnnualBody() injects non-empty default
      const annual = await page.evaluate(
        async ({ n, bid }) => {
          const r = await fetch('/api/hmrc/mtd/annual/se', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nino: n,
              businessId: bid,
              taxYear: '2024-25',
            }),
          });
          return { status: r.status, body: await r.json() };
        },
        { n: NINO, bid: bidSe }
      );
      const emptyRule =
        annual.body?.body?.code === 'RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED';
      logStep('se_annual', {
        ok:
          !emptyRule &&
          (annual.body?.ok === true ||
            annual.body?.status === 200 ||
            annual.body?.status === 429 ||
            annual.status === 200),
        status: annual.status,
        body: annual.body,
        path: annual.body?.path,
      });
      if (emptyRule) {
        throw new Error(
          'SE annual still RULE_INCORRECT_OR_EMPTY_BODY_SUBMITTED — default body not applied'
        );
      }

      const bsas = await page.evaluate(
        async ({ n, bid }) => {
          const r = await fetch('/api/hmrc/mtd/bsas/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nino: n,
              body: {
                accountingPeriod: {
                  startDate: '2024-04-06',
                  endDate: '2025-04-05',
                },
                typeOfBusiness: 'self-employment',
                businessId: bid,
              },
            }),
          });
          return { status: r.status, body: await r.json() };
        },
        { n: NINO, bid: bidSe }
      );
      logStep('bsas_trigger', {
        ok: bsas.status === 200 || bsas.status === 502,
        status: bsas.status,
        body: bsas.body,
        path: bsas.body?.path,
      });
    }

    // P3
    const itsa = await page.evaluate(async (n) => {
      const r = await fetch(
        `/api/hmrc/mtd/itsa-status?nino=${encodeURIComponent(n)}&taxYear=2024-25`
      );
      return { status: r.status, body: await r.json() };
    }, NINO);
    logStep('itsa_status', {
      ok: itsa.status === 200 || itsa.status === 502,
      status: itsa.status,
      body: itsa.body,
      path: itsa.body?.path,
    });

    if (bidSe) {
      const biss = await page.evaluate(
        async ({ n, bid }) => {
          const r = await fetch(
            `/api/hmrc/mtd/biss?nino=${encodeURIComponent(n)}&taxYear=2024-25&businessId=${encodeURIComponent(bid)}&typeOfBusiness=self-employment`
          );
          return { status: r.status, body: await r.json() };
        },
        { n: NINO, bid: bidSe }
      );
      logStep('biss', {
        ok: biss.status === 200 || biss.status === 502,
        status: biss.status,
        body: biss.body,
        path: biss.body?.path,
      });
    }

    const accounts = await page.evaluate(async (n) => {
      const r = await fetch(
        `/api/hmrc/mtd/accounts/balance?nino=${encodeURIComponent(n)}&onlyOpenItems=true`
      );
      return { status: r.status, body: await r.json() };
    }, NINO);
    const inconsistent =
      accounts.body?.body?.code === 'RULE_INCONSISTENT_QUERY_PARAMS';
    logStep('accounts_balance', {
      ok:
        !inconsistent &&
        (accounts.status === 200 ||
          accounts.body?.status === 403 ||
          accounts.body?.status === 429 ||
          accounts.status === 502),
      status: accounts.status,
      body: accounts.body,
      path: accounts.body?.path,
    });
    if (inconsistent) {
      throw new Error('Accounts balance RULE_INCONSISTENT_QUERY_PARAMS — fix query defaults');
    }

    // Fraud validate
    const fph = await page.evaluate(async () => {
      const r = await fetch('/api/hmrc/validate-fraud-headers', { method: 'POST' });
      return { status: r.status, body: await r.json() };
    });
    logStep('fraud_validate', {
      ok: fph.status === 200 || fph.body?.validationCode,
      status: fph.status,
      body: {
        validationCode: fph.body?.validationCode,
        ok: fph.body?.ok,
        warnings: fph.body?.warnings,
        omitted: fph.body?.omittedHonestly,
      },
    });

    evidence.summary = {
      total: evidence.steps.length,
      httpTouched: evidence.steps.filter((s) => s.status).length,
      okish: evidence.steps.filter((s) => s.ok).length,
    };

    const outDir = path.join(process.cwd(), 'docs', 'hmrc');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'sandbox-journey-run.json');
    fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
    console.log('WROTE', outFile, evidence.summary);

    // Soft assert: OAuth + at least businesses call left the building
    expect(st.connection?.connected).toBe(true);
    expect(businesses.status).toBe(200);
  });
});
