import { defineConfig } from '@playwright/test';

/** Production / remote target — no local webServer. Real HMRC sandbox OAuth. */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['**/hmrc-sandbox-oauth.spec.js', '**/hmrc-mtd-full-journey.spec.js'],
  timeout: 300_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL:
      process.env.BASE_URL ||
      'https://spreadsheet-tax-production.up.railway.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: process.env.HEADED === '1' ? false : true,
  },
});
