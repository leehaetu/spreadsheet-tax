import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT) || 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  // Single worker: shared SQLite demo user + session store races under parallel workers.
  fullyParallel: false,
  workers: 1,
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
      CSRF_ENFORCE: '0',
      E2E_RELAX_RATE_LIMIT: '1',
      ALLOW_PREVIEW_SOURCE_WRITES: '1',
      HMRC_ALLOW_LIVE_SUBMIT: '',
      DEMO_PRACTICE_WRITES: '',
    },
    timeout: 120_000,
  },
});
