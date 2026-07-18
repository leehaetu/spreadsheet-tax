/**
 * Product-finish owner checklist (automated).
 * Uses mocked HMRC connection for UI gates only — not SANDBOX_HTTP.
 */
import { test, expect } from '@playwright/test';
import {
  signIn,
  mockHmrcConnected,
  seedSources,
  fillSubmitIds,
  SE_FIXTURE,
} from './helpers.js';

test.describe('Product finish checklist', () => {
  test('sign-in has no authenticated product nav chrome', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/auth-product-shell/);
    await expect(page.locator('aside.cc-sidebar nav.cc-nav')).toHaveCount(0);
    await expect(page.locator('nav.cc-nav a[href="/app?flow=quarterly"]')).toHaveCount(0);
  });

  test('signed-in product shell is consistent across pages', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/home');
    const pages = [
      '/home',
      '/app?flow=quarterly',
      '/year-end',
      '/records',
      '/history',
      '/account',
      '/guide',
    ];
    for (const p of pages) {
      await page.goto(p);
      await expect(page.locator('aside.cc-sidebar nav.cc-nav a').first()).toBeVisible();
      await expect(page.locator('nav.cc-nav')).toContainText('Quarterly updates');
      await expect(page.locator('nav.cc-nav')).toContainText('Year end');
      await expect(page.locator('nav.cc-nav')).toContainText('Sources');
      await expect(page.locator('nav.cc-nav')).toContainText('History');
      await expect(page.locator('nav.cc-nav')).toContainText('Settings');
      await expect(page.locator('nav.cc-nav')).toContainText('Help');
      await expect(page.locator('body')).not.toContainText('HMRC sandbox');
      await expect(page.locator('body')).not.toContainText('Preview only — not sent to HMRC');
    }
  });

  test('quarterly hard-gates without HMRC connection', async ({ page }) => {
    await page.route('**/api/hmrc/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connection: { connected: false, mock: false, label: 'Not connected' },
          oauthConnected: false,
        }),
      });
    });
    await signIn(page, '/app?flow=quarterly');
    await expect(page.locator('#quarterly-gate')).toBeVisible();
    await expect(page.locator('#quarterly-gate')).toContainText(/Connect HMRC before starting/i);
  });

  test('year-end hard-gates without HMRC connection', async ({ page }) => {
    await page.route('**/api/hmrc/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connection: { connected: false, mock: false, label: 'Not connected' },
        }),
      });
    });
    await signIn(page, '/year-end');
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#gate')).toContainText(/Connect HMRC before starting year-end/i);
    await expect(page.locator('[data-ye-card="q1"]')).toBeHidden();
  });

  test('year-end exclusive questions → checklist → work', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/year-end');
    await expect(page.locator('[data-ye-card="q1"]')).toBeVisible();
    await page.locator('[data-ye-card="q1"] [data-ye-answer="se"][data-value="yes"]').click();
    await expect(page.locator('[data-ye-card="q2"]')).toBeVisible();
    await page.locator('[data-ye-card="q2"] [data-ye-answer="uk"][data-value="yes"]').click();
    await expect(page.locator('[data-ye-card="q3"]')).toBeVisible();
    await page.locator('[data-ye-card="q3"] [data-ye-answer="fp"][data-value="no"]').click();
    await expect(page.locator('[data-ye-card="q4"]')).toBeVisible();
    await page.locator('[data-ye-card="q4"] [data-ye-answer="losses"][data-value="no"]').click();
    await expect(page.locator('[data-ye-card="checklist"]')).toBeVisible();
    await expect(page.locator('#year-end-source-board li').first()).toBeVisible();
    await page.locator('#ye-start-steps').click();
    await expect(page.locator('[data-ye-card="work"]')).toBeVisible();
    await expect(page.locator('#stage-title')).not.toHaveText('—');
  });

  test('quarterly exclusive steps: source → upload → map → review → send', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
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
    await expect(page.locator('#quarterly-source-panel')).toBeVisible();
    await expect(page.locator('.quarterly-source-row').first()).toBeVisible();
    await page.locator('.quarterly-source-row').first().click();
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#quarterly-source-panel')).toBeHidden();
    await expect(page.getByText(/Click to choose a spreadsheet or drag it here/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Download free template/i })).toBeVisible();
    await page.setInputFiles('#file-input', SE_FIXTURE);
    await page.locator('#import-btn').click();
    await expect(page.locator('#map-panel')).toBeVisible({ timeout: 20_000 });
    await page.locator('#goto-figures').click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 10_000 });
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();
    await fillSubmitIds(page, { taxYear: '2024-25' });
    await page.locator('#approve-cells').check();
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 20_000 });
  });

  test('onboarding has no create-business UI', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/onboarding');
    await expect(page.locator('#setup-title')).toBeVisible();
    await expect(page.locator('[data-add-type]')).toHaveCount(0);
    // Step 1 welcome copy
    await expect(
      page.locator('body')
    ).toContainText(/does not create businesses|cannot create an HMRC business/i);
    // Step 2 has load button after continue
    await page.fill('#setup-nino', 'AA123456A');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('button', { name: /Load businesses from HMRC/i })).toBeVisible();
  });

  test('history and sources shells', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/history');
    await expect(page.getByRole('heading', { name: 'Submission history' })).toBeVisible();
    await page.goto('/records');
    await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
  });

  test('disconnected home and connect page are individual-only', async ({ page }) => {
    await page.route('**/api/hmrc/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connection: { connected: false, mock: false, label: 'Not connected' },
          oauthConnected: false,
        }),
      });
    });
    await signIn(page, '/home');
    await expect(page.locator('#next-task-title')).toContainText(/Connect HMRC/i);
    await expect(page.locator('#next-task-cta')).toHaveAttribute('href', '/connect-hmrc');
    await expect(page.locator('#connection-status')).toHaveText(/Not connected/i);
    await expect(page.locator('#source-list .cc-source-row')).toHaveCount(0);
    await page.goto('/connect-hmrc');
    await expect(page.getByRole('button', { name: 'Connect HMRC' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connect as agent/i })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Connect as agent/i);
    await expect(page.locator('#disconnect-btn')).toBeHidden();
    await page.goto('/records');
    await expect(page.locator('#source-list')).toContainText(/Connect HMRC first/i);
    await expect(page.locator('#sources-hmrc-action')).toHaveAttribute('href', '/connect-hmrc');
  });
});
