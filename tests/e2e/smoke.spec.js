import { test, expect } from '@playwright/test';
import { signIn, mockHmrcConnected, seedSources, SE_FIXTURE } from './helpers.js';

test.describe('Gate 0 smoke — sales and personal app', () => {
  test('E2E-01 home loads with product branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Spreadsheet Tax/i }).first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/spreadsheet|quarterly|MTD/i);
  });

  test('E2E-02 audience journeys are linked', async ({ page }) => {
    await page.goto('/');
    for (const path of ['/self-employed', '/landlords', '/professionals', '/firms']) {
      const res = await page.request.get(path);
      expect(res.ok()).toBeTruthy();
    }
  });

  test('E2E-03 template download returns CSV', async ({ request }) => {
    const res = await request.get('/download/template');
    expect(res.ok()).toBeTruthy();
    const cd = res.headers()['content-disposition'] || '';
    expect(cd).toMatch(/attachment/i);
    const text = await res.text();
    expect(text).toMatch(/self_employment|section/i);
  });

  test('E2E-04 quarterly upload shows check figures', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/app?flow=quarterly');
    await seedSources(page, [
      {
        id: 'se-1',
        type: 'self_employment',
        label: 'Self-employment',
        nickname: 'Trade',
        businessId: 'XAIS12345678901',
      },
    ]);
    await page.reload();
    await expect(page.getByRole('heading', { name: /quarterly/i })).toBeVisible();
    await page.locator('.quarterly-source-row').first().click();
    await page.setInputFiles('#file-input', SE_FIXTURE);
    await page.locator('#import-btn').click();
    await expect(page.locator('#map-panel')).toBeVisible({ timeout: 20_000 });
  });

  test('E2E-05 sign-in page is auth shell only', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('body')).toHaveClass(/auth-product-shell/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
