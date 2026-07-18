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

test.describe('Visual regression snapshots (smoke)', () => {
  test('sales home visual', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await shot(page, 'sales-home');
  });

  test('app after sample import visual', async ({ page }) => {
    await signIn(page);
    await page.locator('#samples').evaluate((element) => { element.open = true; });
    await page.locator('.sample-btn').first().click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'app-review');
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

  test('mock HMRC connect journey', async ({ page, request }) => {
    // Production with real Hub credentials redirects to HMRC — mock path is local-only
    const st = await request.get('/api/status');
    const status = await st.json();
    test.skip(
      status.oauthMock === false,
      'Real HMRC OAuth configured — mock connect journey is local-only'
    );

    await page.goto('/signin?next=/connect-hmrc');
    await page.fill('#email', 'demo@spreadsheet-tax.example');
    await page.fill('#password', 'DemoPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/connect-hmrc/);
    await page.click('#connect-individual-btn');
    await page.waitForURL(/connect-hmrc/);
    await expect(page.locator('#status')).toContainText(/sandbox|mock|connected|mode/i, {
      timeout: 10_000,
    });
    await shot(page, 'connect-hmrc');
  });
});
