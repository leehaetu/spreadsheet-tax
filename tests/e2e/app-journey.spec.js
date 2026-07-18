import { test, expect } from '@playwright/test';

/**
 * Gate 0 — real customer path: sample → review panel → continue → preview submit.
 */
test.describe('Taxpayer app journey (Gate 0)', () => {
  test('plumber sample reaches review with figures then submit path', async ({
    page,
  }) => {
    await page.goto('/app');
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();

    await page
      .locator('.sample-btn[data-sample="self_employment"]')
      .click();

    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#metric-income')).toBeVisible();
    const income = await page.locator('#metric-income').innerText();
    expect(income).not.toMatch(/^—$/);
    expect(income.length).toBeGreaterThan(1);

    await expect(page.locator('#validation-panel')).toContainText(
      /ready|passed|Check|Fix/i
    );

    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();

    await page.locator('#nino').fill('AA123456A');
    await page.locator('#tax-year').fill('2024-25');
    await page.locator('#bid-se').fill('XAIS12345678901');

    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('#submit-summary')).toContainText(
      /Preview|NOT sent to HMRC|HMRC response/i
    );
  });

  test('mobile viewport: sample still shows review', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await page.locator('.sample-btn').first().click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#goto-submit')).toBeVisible();
  });
});
