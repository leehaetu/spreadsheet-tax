import { test, expect } from '@playwright/test';

async function signIn(page, next = '/app') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.fill('#email', 'demo@spreadsheet-tax.example');
  await page.fill('#password', 'DemoPass123!');
  await page.click('button[type=submit]');
  await page.waitForURL(new RegExp(next.replace(/[/?]/g, '\\$&')));
}

/**
 * Gate 0 — real customer path: sample → review panel → continue → preview submit.
 */
test.describe('Taxpayer app journey (Gate 0)', () => {
  test('plumber sample reaches review with figures then submit path', async ({
    page,
  }) => {
    await signIn(page);
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();
    await page.locator('#samples').evaluate((element) => { element.open = true; });

    await page
      .locator('.sample-btn[data-sample="self_employment"]')
      .click();

    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#validation-panel')).toContainText(
      /ready|passed|Check|Fix/i
    );

    await page.locator('#goto-figures').click();
    await expect(page.locator('#metric-income')).toBeVisible();
    const income = await page.locator('#metric-income').innerText();
    expect(income).not.toMatch(/^—$/);
    expect(income.length).toBeGreaterThan(1);
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();

    await page.locator('#nino').fill('AA123456A');
    await page.locator('#tax-year').fill('2024-25');
    await page.locator('#bid-se').fill('XAIS12345678901');

    // Explicit cell/mapping approval required before send
    await page.locator('#approve-cells').check();
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
    await signIn(page);
    await page.locator('#samples').evaluate((element) => { element.open = true; });
    await page.locator('.sample-btn').first().click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#goto-figures')).toBeVisible();
  });
});
