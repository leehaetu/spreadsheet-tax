import { test, expect } from '@playwright/test';
import {
  signIn,
  mockHmrcConnected,
  seedSources,
  fillSubmitIds,
  SE_FIXTURE,
} from './helpers.js';

/**
 * Gate 0 — customer quarterly path: source → upload → map → figures → send (double/preview).
 */
test.describe('Taxpayer app journey (Gate 0)', () => {
  test('upload path reaches review with figures then submit path', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/app?flow=quarterly');
    await seedSources(page, [
      {
        id: 'se-1',
        type: 'self_employment',
        label: 'Self-employment',
        nickname: 'Plumber',
        businessId: 'XAIS12345678901',
      },
    ]);
    await page.reload();

    await expect(page.locator('#quarterly-source-panel')).toBeVisible();
    await page.locator('.quarterly-source-row').first().click();
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();

    await page.setInputFiles('#file-input', SE_FIXTURE);
    await page.locator('#import-btn').click();

    await expect(page.locator('#map-panel')).toBeVisible({ timeout: 20_000 });
    await page.locator('#goto-figures').click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#summary-cards')).toBeVisible();

    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();

    await fillSubmitIds(page, { taxYear: '2024-25' });
    await page.locator('#approve-cells').check();
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#submit-summary')).toContainText(
      /Preview|NOT sent to HMRC|HMRC response|Update prepared|processed/i
    );
  });
});
