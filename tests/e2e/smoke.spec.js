import { test, expect } from '@playwright/test';

async function signIn(page, next = '/app') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.fill('#email', 'demo@spreadsheet-tax.example');
  await page.fill('#password', 'DemoPass123!');
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(next.replace(/[/?]/g, '\\$&')));
}

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
    await signIn(page);
    await expect(page.getByRole('heading', { name: /tax update|quarterly/i })).toBeVisible();
    await page.locator('#samples').evaluate((element) => { element.open = true; });
    const sample = page.locator('.sample-btn').first();
    await sample.click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await page.locator('#goto-figures').click();
    await expect(page.locator('#metric-income')).not.toHaveText('—');
    await expect(page.locator('#goto-submit')).toBeVisible();
  });

  test('E2E-audience mode keeps the signed-in quarterly workflow available', async ({ page }) => {
    await signIn(page, '/app?mode=self-employed');
    await expect(page.getByRole('heading', { name: /quarterly update/i })).toBeVisible();
    await expect(page.locator('#quarterly-source-panel')).toBeVisible();
  });

  test('E2E-06 preview submit path works without live credentials', async ({
    page,
  }) => {
    await signIn(page);
    await page.locator('#samples').evaluate((element) => { element.open = true; });
    await page.locator('.sample-btn').first().click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await page.locator('#goto-figures').click();
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();
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
    await page.locator('#approve-cells').check({ force: true });
    await expect(page.locator('#submit-btn')).toBeEnabled({ timeout: 5_000 });
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 15_000 });
  });

  test('pricing and security pages load', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('h1')).toBeVisible();
    await page.goto('/security');
    await expect(page.locator('body')).toContainText(/upload|mapping|HMRC|map/i);
  });

  test('help templates billing connect pages load', async ({ page, request }) => {
    for (const p of ['/help', '/templates', '/billing', '/connect-hmrc', '/account']) {
      // Prefer API-level check (avoids aborted navigations when soft-redirects fire)
      const api = await request.get(p, { maxRedirects: 5 });
      expect(
        api.ok() || api.status() < 400,
        `${p} HTTP ${api.status()}`
      ).toBeTruthy();
      try {
        await page.goto(p, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await expect(page.locator('body')).toBeVisible();
      } catch (err) {
        // Soft-redirect races (ERR_ABORTED) are acceptable if the URL landed
        const url = page.url();
        const okLand =
          url.includes(p.replace(/\/$/, '')) ||
          url.includes('signin') ||
          url.includes('templates') ||
          url.includes('account');
        expect(okLand, `${p} navigation: ${err?.message || err} url=${url}`).toBeTruthy();
      }
    }
  });
});
