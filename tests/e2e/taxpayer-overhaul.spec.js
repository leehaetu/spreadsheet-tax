import { test, expect } from '@playwright/test';

async function signIn(page, next = '/onboarding') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.fill('#email', 'demo@spreadsheet-tax.example');
  await page.fill('#password', 'DemoPass123!');
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(next.replace(/[/?]/g, '\\$&')));
}

test.describe('approved taxpayer overhaul', () => {
  test('sets up SE, UK and two foreign properties then starts quarterly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await signIn(page);
    await page.evaluate(() => fetch('/api/me/income-sources', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: [] })
    }));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome to Spreadsheet Tax' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('[data-add-type="self_employment"]').click();
    await page.locator('[data-add-type="uk_property"]').click();
    await page.locator('[data-add-type="foreign_property"]').click();
    await page.locator('[data-add-type="foreign_property"]').click();
    await expect(page.locator('.chosen-source')).toHaveCount(4);
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('[data-source-index="0"] [data-detail="trade"]').fill('Design services');
    await page.locator('[data-source-index="1"] [data-detail="address"]').fill('10 High Street, Bath');
    await page.locator('[data-source-index="2"] [data-detail="address"]').fill('Calle Mayor 10, Madrid');
    await page.locator('[data-source-index="3"] [data-field="countryCode"]').selectOption('FRA');
    await page.locator('[data-source-index="3"] [data-detail="address"]').fill('20 Rue Victor Hugo, Nice');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.review-source')).toHaveCount(4);
    await page.getByRole('button', { name: 'Save setup and go home' }).click();
    await page.waitForURL(/\/home$/);

    await page.goto('/app?flow=quarterly');
    await expect(page.locator('.quarterly-source-row')).toHaveCount(4);
    await page.locator('.quarterly-source-row').nth(2).click();
    await expect(page.locator('#quarterly-source-note')).toContainText('Source selected');
    await expect(page.locator('#upload-panel')).toBeVisible();
  });

  test('year-end exposes source-specific adjustment forms and declaration gate', async ({ page }) => {
    await signIn(page, '/year-end');
    await page.locator('[data-stage-id="se_adjustments"]').click();
    await expect(page.getByRole('heading', { name: 'Self-employment annual adjustments' })).toBeVisible();
    await page.locator('[data-stage-id="uk_adjustments"]').click();
    await expect(page.getByRole('heading', { name: 'UK property annual adjustments' })).toBeVisible();
    await page.locator('[data-stage-id="foreign_adjustments"]').click();
    await expect(page.getByRole('heading', { name: 'Foreign property annual adjustments' })).toBeVisible();
    const firstForeignInput = page.locator('[id^="eoy-fp-private-"]').first();
    await firstForeignInput.fill('125.50');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.locator('[data-stage-id="se_adjustments"]').click();
    await page.locator('[data-stage-id="foreign_adjustments"]').click();
    await expect(page.locator('[id^="eoy-fp-private-"]').first()).toHaveValue('125.50');
    await page.locator('[id^="eoy-fp-private-"]').first().fill('126.00');
    await page.getByRole('link', { name: 'Receipts' }).first().click();
    await expect(page.getByRole('heading', { name: 'Leave without saving?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.locator('[data-stage-id="final_declaration"]').click();
    await expect(page.locator('#eoy-declaration')).toBeVisible();
  });

  test('quarterly sample completes review, declaration and preview receipt', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await signIn(page, '/app?flow=quarterly');
    await page.locator('#samples').evaluate((el) => {
      el.open = true;
    });
    await page.locator('.sample-btn[data-sample="combined"]').click({ force: true });
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 20_000 });
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();
    await page.locator('#nino').fill('AA123456A');
    await page.locator('#tax-year').fill('2026-27');
    await page.locator('#bid-se').fill('XAIS12345678901');
    await page.locator('#bid-uk').fill('XAIS12345678902');
    await page.locator('#bid-fp').fill('XAIS12345678903');
    await page.locator('#approve-cells').check();
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#submit-summary')).toContainText(/Preview|NOT sent to HMRC/i);
  });

  test('manual quarterly figures use the same mapping and review path', async ({ page }) => {
    await signIn(page, '/app?flow=quarterly');
    await page.getByRole('button', { name: 'Enter figures manually' }).click();
    await expect(page.getByRole('heading', { name: 'Enter quarterly figures manually' })).toBeVisible();
    await page.locator('[data-manual-value]').first().fill('1250.00');
    await page.getByRole('button', { name: 'Review these figures' }).click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#metric-income')).toContainText('1,250');
    await expect(page.locator('#validation-panel')).toContainText(/ready|passed|check/i);
  });

  test('history offers filtering, receipts and recovery actions', async ({ page }) => {
    await signIn(page, '/history');
    await expect(page.getByRole('heading', { name: 'Submission history' })).toBeVisible();
    await expect(page.locator('#history-filter')).toBeVisible();
    await expect(page.locator('.recovery-grid article')).toHaveCount(3);
  });
});
