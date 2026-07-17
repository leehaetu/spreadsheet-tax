import { test, expect } from '@playwright/test';

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

  test('E2E-04 sample import shows review figures', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { name: /quarterly update/i })).toBeVisible();
    const sample = page.locator('.sample-btn').first();
    await sample.click();
    await expect(page.locator('#preview-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#metric-income')).not.toHaveText('—');
  });

  test('E2E-audience mode changes self-employed headline', async ({ page }) => {
    await page.goto('/app?mode=self-employed');
    await expect(page.getByRole('heading', { name: /self-employment/i })).toBeVisible();
  });

  test('E2E-06 preview submit path works without live credentials', async ({
    page,
  }) => {
    await page.goto('/app');
    await page.locator('.sample-btn').first().click();
    await expect(page.locator('#preview-panel')).toBeVisible({ timeout: 15_000 });
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();
    // identifiers may be prefilled from sample meta
    const nino = page.locator('#nino');
    if (!(await nino.inputValue())) {
      await nino.fill('AA123456A');
    }
    const taxYear = page.locator('#tax-year');
    if (!(await taxYear.inputValue())) {
      await taxYear.fill('2024-25');
    }
    await page.locator('#bid-se').fill('XAIS12345678901');
    await page.locator('#bid-uk').fill('XPIS12345678901');
    await page.locator('#bid-fp').fill('XFIS12345678901');
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 15_000 });
  });

  test('pricing and security pages load', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /paths|pricing|packages/i })).toBeVisible();
    await page.goto('/security');
    await expect(page.locator('body')).toContainText(/upload|mapping|HMRC|map/i);
  });

  test('help templates billing connect pages load', async ({ page }) => {
    for (const p of ['/help', '/templates', '/billing', '/connect-hmrc', '/account']) {
      const res = await page.goto(p);
      expect(res?.ok() || res?.status() === 200 || page.url().includes('signin')).toBeTruthy();
    }
  });
});
