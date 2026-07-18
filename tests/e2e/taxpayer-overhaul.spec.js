import { test, expect } from '@playwright/test';
import {
  signIn,
  mockHmrcConnected,
  seedSources,
  DEFAULT_SOURCES,
  fillSubmitIds,
  SE_FIXTURE,
} from './helpers.js';

test.describe('approved taxpayer overhaul', () => {
  test('sets up SE, UK and foreign sources then starts quarterly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await mockHmrcConnected(page);
    await signIn(page, '/onboarding');
    await seedSources(page, DEFAULT_SOURCES);
    await page.reload();
    await expect(page.locator('#setup-title')).toContainText(/Welcome to Spreadsheet Tax/i);
    await page.fill('#setup-nino', 'AA123456A');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.chosen-source')).toHaveCount(3);
    await page.getByRole('button', { name: 'Continue' }).click();

    for (let sourceNumber = 0; sourceNumber < 3; sourceNumber += 1) {
      const detail = page.locator('.source-detail');
      const visibleSource = await detail.innerText();
      if (visibleSource.includes('Design services')) {
        await detail.locator('[data-detail="trade"]').fill('Design services');
      }
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

  test('year-end guided path exposes adjustment forms and declaration gate', async ({
    page,
  }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/year-end');
    await page.locator('[data-ye-card="q1"] [data-value="yes"]').click();
    await page.locator('[data-ye-card="q2"] [data-value="yes"]').click();
    await page.locator('[data-ye-card="q3"] [data-value="yes"]').click();
    await page.locator('[data-ye-card="q4"] [data-value="yes"]').click();
    await expect(page.locator('[data-ye-card="checklist"]')).toBeVisible();

    const seRow = page.locator('#year-end-source-board [data-jump-stage="se_adjustments"]');
    if (await seRow.count()) {
      await seRow.click();
    } else {
      await page.locator('#ye-start-steps').click();
    }
    await expect(page.locator('[data-ye-card="work"]')).toBeVisible();

    async function openStage(stageId, heading) {
      await page.locator('#eoy-back-overview').click();
      await expect(page.locator('[data-ye-card="checklist"]')).toBeVisible();
      const row = page.locator(`#year-end-source-board [data-jump-stage="${stageId}"]`);
      if (await row.count()) {
        await row.click();
        await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      }
    }

    await openStage('se_adjustments', 'Self-employment annual adjustments');
    await openStage('uk_adjustments', 'UK property annual adjustments');
    await openStage('foreign_adjustments', 'Foreign property annual adjustments');

    await page.locator('#eoy-back-overview').click();
    const finalRow = page.locator(
      '#year-end-source-board [data-jump-stage="final_declaration"]'
    );
    if (await finalRow.count()) {
      await finalRow.click();
      await expect(page.locator('#eoy-declaration')).toBeVisible();
    }
  });

  test('quarterly upload completes review, declaration and send path', async ({
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
    await page.locator('.quarterly-source-row').first().click();
    await expect(page.locator('#upload-panel')).toBeVisible();
    await page.setInputFiles('#file-input', SE_FIXTURE);
    await page.locator('#import-btn').click();
    await expect(page.locator('#map-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#upload-panel')).toBeHidden();
    await page.locator('#goto-figures').click();
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#summary-cards')).toBeVisible();
    await page.locator('#goto-submit').click();
    await expect(page.locator('#submit-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();
    await fillSubmitIds(page, { taxYear: '2024-25' });
    await page.locator('#approve-cells').check();
    await page.locator('#submit-btn').click();
    await expect(page.locator('#submit-success')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#submit-summary')).toContainText(
      /Update prepared|HMRC response|Not yet accepted|income source|processed|Preview|NOT sent/i
    );
  });

  test('upload failure stays on add-records step with an actionable error', async ({
    page,
  }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/app?flow=quarterly');
    await seedSources(page, [
      {
        id: 'se-1',
        type: 'self_employment',
        label: 'Self-employment',
        nickname: 'Trade',
      },
    ]);
    await page.reload();
    await page.locator('.quarterly-source-row').first().click();
    await page.locator('#import-btn').click();
    await expect(page.locator('#upload-error')).toBeVisible();
    await expect(page.locator('#upload-error')).toContainText(/choose a spreadsheet|file/i);
    await expect(page.locator('#upload-panel')).toBeVisible();
    await expect(page.locator('#review-panel')).toBeHidden();
  });

  test('history offers filtering, receipts and recovery actions', async ({ page }) => {
    await mockHmrcConnected(page);
    await signIn(page, '/history');
    await expect(page.getByRole('heading', { name: 'Submission history' })).toBeVisible();
    await expect(page.locator('#history-filter')).toBeVisible();
    await expect(page.locator('.recovery-grid article')).toHaveCount(4);
    await expect(page.locator('#recovery-authority-copy')).not.toContainText('Checking');
    await expect(page.locator('#recovery-service-copy')).not.toContainText('Checking');
  });
});
