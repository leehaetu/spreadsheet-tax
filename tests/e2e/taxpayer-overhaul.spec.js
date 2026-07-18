import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureCsv = path.join(__dirname, '../../fixtures/combined-all-sources.csv');

async function signIn(page, next = '/onboarding') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.fill('#email', 'demo@spreadsheet-tax.example');
  await page.fill('#password', 'DemoPass123!');
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(next.replace(/[/?]/g, '\\$&')));
}

test.describe('approved taxpayer overhaul', () => {
  test('sets up SE, UK and the single HMRC foreign-property business then starts quarterly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await signIn(page);
    const fixtureSources = [
      { id: 'se-1', type: 'self_employment', label: 'Self-employment', nickname: 'Design services' },
      { id: 'uk-1', type: 'uk_property', label: 'UK property', nickname: 'Bath rental' },
      { id: 'fp-1', type: 'foreign_property', label: 'Foreign property', nickname: 'Foreign property business' },
    ];
    await page.evaluate((sources) => fetch('/api/me/income-sources', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources })
    }), fixtureSources);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Set up your account' })).toBeVisible();
    await page.fill('#setup-nino', 'AA123456A');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.chosen-source')).toHaveCount(3);
    await page.getByRole('button', { name: 'Continue' }).click();

    for (let sourceNumber = 0; sourceNumber < 3; sourceNumber += 1) {
      const detail = page.locator('.source-detail');
      const visibleSource = await detail.innerText();
      if (visibleSource.includes('Design services')) await detail.locator('[data-detail="trade"]').fill('Design services');
      await page.locator('#next-step').click();
    }
    await expect(page.locator('.review-source')).toHaveCount(3);
    const lastReviewSource = page.locator('.review-source').last();
    const lastReviewName = await lastReviewSource.locator('strong').innerText();
    await lastReviewSource.locator('[data-review-edit]').click();
    await expect(page.locator('.source-detail')).toContainText(lastReviewName);
    await page.locator('#next-step').click();
    await expect(page.locator('.review-source')).toHaveCount(3);
    await page.getByRole('button', { name: 'Save setup and go home' }).click();
    await page.waitForURL(/\/home$/);

    await page.goto('/app?flow=quarterly');
    await expect(page.locator('.quarterly-source-row')).toHaveCount(3);
    await page.locator('.quarterly-source-row').nth(2).click();
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#quarterly-source-panel')).toBeHidden();
  });

  test('year-end exposes source-specific adjustment forms and declaration gate', async ({ page }) => {
    await signIn(page, '/year-end');
    await page.evaluate(() => fetch('/api/import/sample', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sample: 'foreign_property' })
    }));
    await page.reload();
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
    await page.locator('.cc-nav a[href="/history"]').click();
    await expect(page.getByRole('heading', { name: 'Leave without saving?' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.locator('[data-stage-id="final_declaration"]').click();
    await expect(page.locator('#eoy-declaration')).toBeVisible();
  });

  test('quarterly upload completes review, declaration and send path', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await signIn(page, '/app?flow=quarterly');
    // Seed sources so continue is available
    await page.evaluate(() => fetch('/api/me/income-sources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: [
          { id: 'se-1', type: 'self_employment', label: 'Self-employment', nickname: 'Trade' },
        ],
      }),
    }));
    await page.reload();
    await page.locator('.quarterly-source-row').first().click();
    await expect(page.locator('#upload-panel')).toBeVisible();
    await page.setInputFiles('#file-input', fixtureCsv);
    await page.locator('#import-btn').click();
    await expect(page.locator('#map-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#upload-panel')).toBeHidden();
    await page.locator('#goto-figures').click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#summary-cards')).toBeVisible();
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();
    // IDs are hidden fields filled from preferences / defaults
    await page.evaluate(() => {
      const n = document.getElementById('nino');
      const ty = document.getElementById('tax-year');
      const se = document.getElementById('bid-se');
      if (n) n.value = 'AA123456A';
      if (ty) ty.value = '2026-27';
      if (se) se.value = 'XAIS12345678901';
    });
    await page.locator('#approve-cells').check();
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#submit-summary')).toContainText(/Update prepared|HMRC response|Not yet accepted|income source/i);
    await expect(page.locator('#submit-btn')).toBeDisabled();
    await expect(page.locator('#submit-btn')).toHaveText('Update already processed');
  });

  test('upload failure stays on add-records step with an actionable error', async ({ page }) => {
    await signIn(page, '/app?flow=quarterly');
    await page.evaluate(() => fetch('/api/me/income-sources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: [{ id: 'se-1', type: 'self_employment', label: 'Self-employment', nickname: 'Trade' }],
      }),
    }));
    await page.reload();
    await page.locator('.quarterly-source-row').first().click();
    await page.locator('#import-btn').click();
    await expect(page.locator('#upload-error')).toBeVisible();
    await expect(page.locator('#upload-error')).toContainText('choose a spreadsheet');
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();
  });

  test('history offers filtering, receipts and recovery actions', async ({ page }) => {
    await signIn(page, '/history');
    await expect(page.getByRole('heading', { name: 'Submission history' })).toBeVisible();
    await expect(page.locator('#history-filter')).toBeVisible();
    await expect(page.locator('.recovery-grid article')).toHaveCount(4);
    await expect(page.locator('#recovery-authority-copy')).not.toContainText('Checking');
    await expect(page.locator('#recovery-service-copy')).not.toContainText('Checking');
  });
});
