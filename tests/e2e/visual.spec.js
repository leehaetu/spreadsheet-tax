import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotDir = path.join(__dirname, '../../test-results/visual');

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true });
});

async function shot(page, name) {
  await page.screenshot({
    path: path.join(shotDir, `${name}.png`),
    fullPage: true,
  });
}

async function signIn(page, next = '/app') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.fill('#email', 'demo@spreadsheet-tax.example');
  await page.fill('#password', 'DemoPass123!');
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(next.replace(/[/?]/g, '\\$&')));
}

async function mockHmrcConnected(page) {
  await page.route('**/api/hmrc/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connection: { connected: true, mock: false, label: 'Connected' },
        oauthConnected: true,
        oauthMock: false,
      }),
    });
  });
}

test.describe('Visual regression snapshots (smoke)', () => {
  test('sales home visual', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await shot(page, 'sales-home');
  });

  test('quarterly source picker visual', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/app?flow=quarterly');
    await page.evaluate(() =>
      fetch('/api/me/income-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [
            {
              id: 'se-1',
              type: 'self_employment',
              label: 'Self-employment',
              nickname: 'Trade',
            },
          ],
        }),
      })
    );
    await page.reload();
    await expect(page.locator('#quarterly-source-panel')).toBeVisible({ timeout: 10_000 });
    await shot(page, 'app-quarterly-sources');
  });

  test('signin page visual', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await shot(page, 'signin');
  });

  test('workspace redirects attention when signed out', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/signin\?next=/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await shot(page, 'workspace-signed-out');
  });

  test('pricing page visual', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('h1')).toBeVisible();
    await shot(page, 'pricing');
  });

  test('billing and help visual', async ({ page }) => {
    await page.goto('/billing');
    await shot(page, 'billing');
    await page.goto('/help');
    await shot(page, 'help');
  });
});

test.describe('Auth workspace journey', () => {
  test('demo login opens product home then workspace', async ({ page }) => {
    await page.goto('/signin?next=/home');
    await page.fill('#email', 'demo@spreadsheet-tax.example');
    await page.fill('#password', 'DemoPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/home/);
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)|Hello/i })).toBeVisible({
      timeout: 10_000,
    });
    await shot(page, 'product-home-signed-in');
    await page.goto('/workspace');
    await expect(page.locator('#ws-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#client-body tr').first()).toBeVisible();
    await shot(page, 'workspace-signed-in');
  });

  test('history page requires sign-in', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL(/\/signin\?next=/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await shot(page, 'history-signed-out');
  });

  test('global admin metrics remain server-restricted in the browser', async ({ page }) => {
    await page.goto('/signin?next=/admin');
    await page.fill('#email', 'demo@spreadsheet-tax.example');
    await page.fill('#password', 'DemoPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/admin/);
    await expect(page.locator('#stats')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#invite-panel')).toBeVisible({ timeout: 10_000 });
    await shot(page, 'admin-restricted');
  });

  test('account page after demo login', async ({ page }) => {
    await page.goto('/signin?next=/account');
    await page.fill('#email', 'demo@spreadsheet-tax.example');
    await page.fill('#password', 'DemoPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/account/);
    await expect(page.locator('#stats')).toBeVisible({ timeout: 10_000 });
    await shot(page, 'account-signed-in');
  });

  test('mock HMRC connect journey', async ({ page, context }) => {
    // Production with real Hub credentials redirects to HMRC — mock path is local-only
    const st = await page.request.get('/api/status');
    const status = await st.json();
    test.skip(
      status.oauthMock === false,
      'Real HMRC OAuth configured — mock connect journey is local-only'
    );

    // Unique user avoids demo rate-limit lockout after many e2e logins
    const email = `visual-connect-${Date.now()}@example.com`;
    const password = 'DemoPass123!';
    const reg = await page.request.post('/api/auth/register', {
      data: {
        email,
        password,
        name: 'Visual Connect',
        consentPrivacy: true,
        consentTerms: true,
      },
    });
    if (!reg.ok()) {
      const login = await page.request.post('/api/auth/login', {
        data: { email: 'demo@spreadsheet-tax.example', password },
      });
      test.skip(!login.ok(), 'Could not register or login for mock connect visual');
    }

    await page.goto('/connect-hmrc');
    await expect(page.locator('#connect-individual-btn')).toBeVisible({ timeout: 10_000 });
    await page.click('#connect-individual-btn');
    await page.waitForURL(/connect-hmrc/, { timeout: 15_000 });
    await expect(page.locator('#status-human, #connection-status').first()).toContainText(
      /Connected|Not connected|Checking/i,
      { timeout: 10_000 }
    );
    await shot(page, 'connect-hmrc');
  });
});
