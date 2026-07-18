import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.BASE_URL || 'https://spreadsheet-tax-production.up.railway.app',
    trace: 'off',
  },
});
