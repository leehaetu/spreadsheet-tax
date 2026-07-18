/**
 * Shared Playwright helpers for product e2e.
 * Mock HMRC connection is for UI path tests only — not SANDBOX_HTTP evidence.
 */
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SE_FIXTURE = path.join(__dirname, '../../fixtures/self-employment-only.csv');
export const COMBINED_FIXTURE = path.join(
  __dirname,
  '../../fixtures/combined-all-sources.csv'
);

export async function signIn(page, next = '/home') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`);
  await page.fill('#email', 'demo@spreadsheet-tax.example');
  await page.fill('#password', 'DemoPass123!');
  await page.click('button[type=submit]');
  // Match path only (ignore query order) so /app?flow=quarterly is stable
  const pathOnly = next.split('?')[0];
  try {
    await page.waitForURL(
      (url) => url.pathname === pathOnly || url.pathname.endsWith(pathOnly),
      { timeout: 20_000 }
    );
  } catch (err) {
    const errText = await page.locator('#err').textContent().catch(() => '');
    throw new Error(
      `signIn failed (still on ${page.url()}). Form error: ${errText || '(none)'}. Original: ${err}`
    );
  }
}

/**
 * Simulate a non-mock HMRC connection so product hard-gates open.
 * Labelled for tests only — does not prove real HMRC OAuth.
 */
export async function mockHmrcConnected(page) {
  await page.route('**/api/hmrc/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connection: {
          connected: true,
          mock: false,
          label: 'Connected',
          authorityType: 'individual',
        },
        oauthConnected: true,
        oauthMock: false,
        hmrcMode: 'sandbox',
      }),
    });
  });
}

export async function seedSources(page, sources) {
  await page.evaluate((list) => {
    return fetch('/api/me/income-sources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: list }),
    });
  }, sources);
}

export const DEFAULT_SOURCES = [
  {
    id: 'se-1',
    type: 'self_employment',
    label: 'Self-employment',
    nickname: 'Design services',
    businessId: 'XAIS12345678901',
  },
  {
    id: 'uk-1',
    type: 'uk_property',
    label: 'UK property',
    nickname: 'Bath rental',
    businessId: 'XP0000000000001',
  },
  {
    id: 'fp-1',
    type: 'foreign_property',
    label: 'Foreign property',
    nickname: 'Foreign property business',
    businessId: 'XP0000000000002',
  },
];

/** Fill hidden submission identifiers for double-mode preview submit. */
export async function fillSubmitIds(page, opts = {}) {
  await page.evaluate((ids) => {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    set('nino', ids.nino);
    set('tax-year', ids.taxYear);
    set('bid-se', ids.businessIdSe);
    set('bid-uk', ids.businessIdUk || '');
    set('bid-fp', ids.businessIdFp || '');
  }, {
    nino: opts.nino || 'AA123456A',
    taxYear: opts.taxYear || '2024-25',
    businessIdSe: opts.businessIdSe || 'XAIS12345678901',
    businessIdUk: opts.businessIdUk || 'XP0000000000001',
    businessIdFp: opts.businessIdFp || 'XP0000000000002',
  });
}
