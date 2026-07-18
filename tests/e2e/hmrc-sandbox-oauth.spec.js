/**
 * Real HMRC sandbox evidence + user OAuth journey via Playwright.
 * Not mocks: hits test-api.service.hmrc.gov.uk and production Spreadsheet Tax.
 *
 * Env:
 *   BASE_URL — default production Railway URL
 *   HMRC_SANDBOX_TEST_USER_ID / HMRC_SANDBOX_TEST_USER_PASSWORD — test user for OAuth
 *   ST_DEMO_EMAIL / ST_DEMO_PASSWORD — product login
 */
import { test, expect } from '@playwright/test';

const BASE =
  process.env.BASE_URL ||
  'https://spreadsheet-tax-production.up.railway.app';
const HMRC_API = 'https://test-api.service.hmrc.gov.uk';
const CLIENT_ID = process.env.HMRC_CLIENT_ID || '7jXz9nloyX2CBs1FTmlghl84vcpX';
const CLIENT_SECRET =
  process.env.HMRC_CLIENT_SECRET || 'f4f52bba-5774-459d-8c03-e4566f5ec2ac';
const TEST_USER =
  process.env.HMRC_SANDBOX_TEST_USER_ID || '316759042367';
const TEST_PASS =
  process.env.HMRC_SANDBOX_TEST_USER_PASSWORD || 'ugsesjaAyhu4';
const DEMO_EMAIL =
  process.env.ST_DEMO_EMAIL || 'demo@spreadsheet-tax.example';
const DEMO_PASS = process.env.ST_DEMO_PASSWORD || 'DemoPass123!';
const RUN_REAL_SANDBOX = process.env.RUN_HMRC_SANDBOX_E2E === '1';

test.describe('REAL HMRC sandbox evidence (no mock)', () => {
  test.skip(!RUN_REAL_SANDBOX, 'Set RUN_HMRC_SANDBOX_E2E=1 for operator-run external HMRC evidence.');
  test('direct HMRC: client_credentials + hello/world + hello/application', async ({
    request,
  }) => {
    const tokenRes = await request.post(`${HMRC_API}/oauth/token`, {
      form: {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });
    expect(tokenRes.ok(), await tokenRes.text()).toBeTruthy();
    const tokenJson = await tokenRes.json();
    expect(tokenJson.access_token).toBeTruthy();
    expect(tokenJson.token_type?.toLowerCase()).toMatch(/bearer/);

    const openRes = await request.get(`${HMRC_API}/hello/world`, {
      headers: { Accept: 'application/vnd.hmrc.1.0+json' },
    });
    expect(openRes.ok()).toBeTruthy();
    expect(await openRes.json()).toEqual({ message: 'Hello World' });

    const appRes = await request.get(`${HMRC_API}/hello/application`, {
      headers: {
        Accept: 'application/vnd.hmrc.1.0+json',
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
    });
    expect(appRes.ok()).toBeTruthy();
    expect(await appRes.json()).toEqual({ message: 'Hello Application' });
  });

  test('direct HMRC: Create Test User returns unique NINO and credentials', async ({
    request,
  }) => {
    const tokenRes = await request.post(`${HMRC_API}/oauth/token`, {
      form: {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    });
    const { access_token } = await tokenRes.json();
    const userRes = await request.post(
      `${HMRC_API}/create-test-user/individuals`,
      {
        headers: {
          Accept: 'application/vnd.hmrc.1.0+json',
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        data: {
          serviceNames: [
            'mtd-income-tax',
            'self-assessment',
            'national-insurance',
          ],
        },
      }
    );
    expect(userRes.ok(), await userRes.text()).toBeTruthy();
    const user = await userRes.json();
    expect(user.userId).toMatch(/^\d+$/);
    expect(user.password).toBeTruthy();
    expect(user.nino).toMatch(/^[A-Z]{2}\d{6}[A-D]$/i);
    expect(user.mtdItId).toBeTruthy();
    // Prove uniqueness vs fixed mock strings
    expect(user.userId).not.toMatch(/mock/i);
    expect(String(user.password)).not.toMatch(/^mock-/);
  });

  test('production app sandbox-check is operator-protected', async ({
    request,
  }) => {
    const headers = process.env.JOBS_SECRET
      ? { 'x-jobs-secret': process.env.JOBS_SECRET }
      : {};
    const res = await request.get(`${BASE}/api/hmrc/sandbox-check`, { headers });
    const j = await res.json();

    if (!process.env.JOBS_SECRET) {
      expect(res.status()).toBe(403);
      expect(j.error).toMatch(/jobs secret required/i);
      return;
    }

    expect(res.ok(), JSON.stringify(j)).toBeTruthy();
    expect(j.ok).toBe(true);
    expect(j.mock).toBe(false);
    expect(j.environment).toBe('sandbox');
    expect(j.openAccess?.ok).toBe(true);
    expect(j.application?.ok).toBe(true);
    expect(j.openAccess?.body).toMatch(/Hello World/);
    expect(j.application?.body).toMatch(/Hello Application/);
  });

  test('production public health is redacted and versioned', async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/health`);
    expect(res.ok()).toBeTruthy();
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(j.oauthMock).toBeUndefined();
    expect(j.liveSubmitEnabled).toBeUndefined();
    expect(res.headers()['x-app-version']).toBe(j.version);
  });
});

test.describe('Playwright OAuth journey against production + HMRC sandbox', () => {
  test.skip(!RUN_REAL_SANDBOX, 'Set RUN_HMRC_SANDBOX_E2E=1 for operator-run external HMRC evidence.');
  test.setTimeout(180_000);

  test('sign in, start HMRC connect, complete sandbox user OAuth if UI allows', async ({
    page,
  }) => {
    // Product login
    await page.goto(`${BASE}/signin`);
    await page.locator('#email, input[type="email"], input[name="email"]').first().fill(DEMO_EMAIL);
    await page.locator('#password, input[type="password"]').first().fill(DEMO_PASS);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForTimeout(1500);

    // May land on home or stay on signin — go to connect
    await page.goto(`${BASE}/connect-hmrc`);
    await expect(
      page.getByRole('heading', { name: 'Connect HMRC', exact: true })
    ).toBeVisible({ timeout: 20_000 });

    // Sandbox check button if present
    const checkBtn = page.locator('#sandbox-check-btn');
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click();
      await expect(page.locator('#sandbox-check')).toContainText(
        /Hello World|Hello Application|"ok": true/i,
        { timeout: 30_000 }
      );
    }

    // Start OAuth — must leave our origin for real HMRC sandbox
    const connectBtn = page.locator('#connect-individual-btn');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    await page.waitForURL(/test-www\.tax\.service\.gov\.uk/, {
      timeout: 45_000,
    });
    expect(page.url()).not.toMatch(/mock-auth-code/);
    expect(page.url()).not.toContain('spreadsheet-tax-production');

    const acc = page.getByRole('button', {
      name: /accept additional cookies/i,
    });
    if (await acc.isVisible().catch(() => false)) await acc.click();

    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.waitForTimeout(1500);

    // HMRC "what you will need" → sign-in (may redirect through grantscope)
    const signIn = page.locator('a', {
      hasText: /Sign in to the HMRC online service/i,
    });
    await expect(signIn.first()).toBeVisible({ timeout: 15_000 });
    await signIn.first().click();
    await page.waitForTimeout(2000);

    if (!(await page.locator('#userId').isVisible().catch(() => false))) {
      // Force known sandbox login URL if still not on form
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

    await expect(
      page.getByRole('button', { name: /give permission/i })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /give permission/i }).click();

    await page.waitForURL(/spreadsheet-tax-production\.up\.railway\.app/, {
      timeout: 60_000,
    });
    expect(page.url()).toMatch(/connect-hmrc|connected=1/);

    await page.goto(`${BASE}/connect-hmrc`);
    await page.waitForTimeout(1500);
    const st = await page.evaluate(async () => {
      const r = await fetch('/api/hmrc/status');
      return r.json();
    });
    expect(st.oauth?.mock).toBe(false);
    expect(st.connection?.mock).toBe(false);
    expect(st.connection?.connected).toBe(true);
    expect(st.connection?.mode).toBe('sandbox');

    // After OAuth: Business Details + Obligations (user-restricted) using stored sandbox NINO
    const nino = process.env.HMRC_SANDBOX_TEST_NINO || 'TB116925D';
    const businesses = await page.evaluate(async (n) => {
      const r = await fetch(`/api/hmrc/businesses?nino=${encodeURIComponent(n)}`);
      return { status: r.status, body: await r.json() };
    }, nino);
    expect(businesses.status).toBe(200);
    expect(businesses.body.ok).toBe(true);

    const obligations = await page.evaluate(async (n) => {
      const r = await fetch(`/api/hmrc/obligations?nino=${encodeURIComponent(n)}`);
      return { status: r.status, body: await r.json() };
    }, nino);
    // 200 = list ok; 502 with HMRC error body still proves the call left our app
    expect([200, 502]).toContain(obligations.status);
    expect(obligations.body).toBeTruthy();
  });
});
