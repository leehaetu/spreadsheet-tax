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

test.describe('Visual regression snapshots (smoke)', () => {
  test('sales home visual', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await shot(page, 'sales-home');
  });

  test('app after sample import visual', async ({ page }) => {
    await page.goto('/app');
    await page.locator('.sample-btn').first().click();
    await expect(page.locator('#preview-panel')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'app-review');
  });

  test('signin page visual', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await shot(page, 'signin');
  });

  test('workspace redirects attention when signed out', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.locator('#gate')).toBeVisible();
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
  test('demo login opens workspace clients', async ({ page }) => {
    await page.goto('/signin');
    await page.fill('#email', 'demo@spreadsheet-tax.example');
    await page.fill('#password', 'DemoPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/workspace/);
    await expect(page.locator('#ws-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#client-body tr').first()).toBeVisible();
    await shot(page, 'workspace-signed-in');
  });

  test('mock HMRC connect journey', async ({ page }) => {
    await page.goto('/signin?next=/connect-hmrc');
    await page.fill('#email', 'demo@spreadsheet-tax.example');
    await page.fill('#password', 'DemoPass123!');
    await page.click('button[type=submit]');
    await page.waitForURL(/connect-hmrc/);
    await page.click('#connect-btn');
    await page.waitForURL(/connect-hmrc/);
    await expect(page.locator('#status')).toContainText(/sandbox|mock|connected|mode/i, {
      timeout: 10_000,
    });
    await shot(page, 'connect-hmrc');
  });
});
