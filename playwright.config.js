import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT) || 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node src/server.js`,
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: String(port),
      HMRC_ALLOW_LIVE_SUBMIT: '',
      DEMO_PRACTICE_WRITES: '',
    },
    timeout: 120_000,
  },
});
