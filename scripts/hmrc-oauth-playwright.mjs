/**
 * Real HMRC sandbox OAuth end-to-end against production Spreadsheet Tax.
 * Usage: node scripts/hmrc-oauth-playwright.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE =
  process.env.BASE_URL ||
  'https://spreadsheet-tax-production.up.railway.app';
const TEST_USER = process.env.HMRC_SANDBOX_TEST_USER_ID || '316759042367';
const TEST_PASS =
  process.env.HMRC_SANDBOX_TEST_USER_PASSWORD || 'ugsesjaAyhu4';
const DEMO_EMAIL =
  process.env.ST_DEMO_EMAIL || 'demo@spreadsheet-tax.example';
const DEMO_PASS = process.env.ST_DEMO_PASSWORD || 'DemoPass123!';

fs.mkdirSync('test-results', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const steps = [];

function log(msg) {
  steps.push(msg);
  console.log(msg);
}

async function snap(name) {
  const path = `test-results/oauth-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log(`screenshot ${path} url=${page.url()}`);
}

async function clickText(re, role = 'button') {
  const loc =
    role === 'link'
      ? page.getByRole('link', { name: re })
      : page.getByRole('button', { name: re });
  if (await loc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await loc.first().click();
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}

try {
  log('=== product login ===');
  await page.goto(`${BASE}/signin`);
  await page.locator('#email').fill(DEMO_EMAIL);
  await page.locator('#password').fill(DEMO_PASS);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForTimeout(2000);
  log(`logged in at ${page.url()}`);

  log('=== connect-hmrc ===');
  await page.goto(`${BASE}/connect-hmrc`);
  await page.waitForTimeout(1500);
  await snap('01-connect');

  log('=== start OAuth ===');
  await page.locator('#connect-btn').click();
  await page.waitForURL(/tax\.service\.gov\.uk|hmrc\.gov\.uk/, {
    timeout: 60000,
  });
  log(`on HMRC: ${page.url()}`);
  await snap('02-hmrc-start');

  // cookie banner
  await clickText(/accept additional cookies/i);
  await clickText(/accept all cookies/i);

  // multi-step until login form or grant
  for (let i = 0; i < 20; i++) {
    const url = page.url();
    const body = await page.locator('body').innerText();
    log(`step ${i} url=${url.slice(0, 140)}`);

    if (url.includes('spreadsheet-tax') && (url.includes('connect') || url.includes('callback') || url.includes('connected'))) {
      log('returned to app');
      break;
    }

    // login form (HMRC test user)
    if (await page.locator('#userId').isVisible().catch(() => false)) {
      log('filling HMRC test user credentials (real sandbox user)');
      await page.locator('#userId').fill(TEST_USER);
      await page.locator('#password').fill(TEST_PASS);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForTimeout(3500);
      await snap(`03-after-login-${i}`);
      continue;
    }

    // Give permission
    if (
      await page
        .getByRole('button', { name: /give permission/i })
        .isVisible()
        .catch(() => false)
    ) {
      log('clicking Give permission (real HMRC grant)');
      await page.getByRole('button', { name: /give permission/i }).click();
      await page.waitForTimeout(5000);
      await snap(`04-after-grant-${i}`);
      continue;
    }

    // Continue buttons
    if (await clickText(/^continue$/i)) {
      await snap(`05-continue-${i}`);
      continue;
    }

    // Sign in CTA — may be link text or button-styled link
    const signInLink = page.locator('a', {
      hasText: /Sign in to the HMRC online service/i,
    });
    if (await signInLink.first().isVisible().catch(() => false)) {
      const href = await signInLink.first().getAttribute('href');
      log(`sign-in link href=${href}`);
      await signInLink.first().click();
      await page.waitForTimeout(2500);
      // If still no login form, force api-test-login path from grantscope redirect
      if (!(await page.locator('#userId').isVisible().catch(() => false))) {
        const u = page.url();
        if (u.includes('grantscope') || u.includes('whatYouWillNeed')) {
          // Known sandbox login entry
          const m = u.match(/auth_id=([^&]+)/);
          const s = u.match(/state=([^&]+)/);
          if (m && s) {
            const loginUrl = `https://test-www.tax.service.gov.uk/api-test-login/sign-in?continue=${encodeURIComponent(
              `/oauth/grantscope?auth_id=${m[1]}&state=${s[1]}`
            )}&origin=oauth-frontend&clientId=${process.env.HMRC_CLIENT_ID || '7jXz9nloyX2CBs1FTmlghl84vcpX'}`;
            log(`navigating loginUrl ${loginUrl.slice(0, 120)}…`);
            await page.goto(loginUrl);
            await page.waitForTimeout(2000);
          }
        }
      }
      await snap(`06-signin-link-${i}`);
      continue;
    }

    if (await clickText(/^sign in$/i, 'link') || await clickText(/sign in/i, 'link')) {
      await snap(`06b-signin-${i}`);
      continue;
    }

    log(`no action matched; body: ${body.slice(0, 280).replace(/\n/g, ' | ')}`);
    await snap(`07-stuck-${i}`);
    break;
  }

  // Prefer wait for callback
  if (!page.url().includes('spreadsheet-tax')) {
    try {
      await page.waitForURL(/spreadsheet-tax/, { timeout: 30000 });
      log(`callback ${page.url()}`);
    } catch {
      log(`still on ${page.url()}`);
    }
  }

  await page.goto(`${BASE}/connect-hmrc`);
  await page.waitForTimeout(2000);
  const statusText = await page.locator('#status').innerText();
  log(`STATUS ${statusText}`);

  const apiStatus = await page.evaluate(async () => {
    const r = await fetch('/api/hmrc/status');
    return r.json();
  });
  log(`API ${JSON.stringify(apiStatus)}`);
  await snap('99-final');

  const connected =
    apiStatus?.connection?.connected === true &&
    apiStatus?.connection?.mock === false;
  const mockOff = apiStatus?.oauth?.mock === false;

  console.log('\n=== RESULT ===');
  console.log(
    JSON.stringify(
      {
        realHmrcHostReached: true,
        oauthMockOff: mockOff,
        userConnected: connected,
        connection: apiStatus?.connection || null,
        finalUrl: page.url(),
      },
      null,
      2
    )
  );

  if (!mockOff) process.exitCode = 2;
  else if (!connected) process.exitCode = 3; // partial: real path, not full grant
  else process.exitCode = 0;
} catch (e) {
  console.error(e);
  await snap('error');
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    'test-results/oauth-steps.json',
    JSON.stringify(steps, null, 2)
  );
  await browser.close();
}
