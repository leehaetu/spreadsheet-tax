/**
 * Machine-readable honesty map for HMRC / security review.
 *
 * NOT a public HTTP surface. Load from code:
 *   import { buildIntegrityMap } from './lib/integrity-map.js'
 * or: node scripts/print-integrity-map.mjs
 *
 * Do not re-expose at /integrity or /api/integrity without explicit owner approval.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listFraudHeaderKeys } from './fraud-headers.js';
import { emailDeliveryMode } from './email.js';
import { oauthConfig } from './hmrc-oauth.js';
import { mtdCapabilityMatrix } from './hmrc-api.js';
import {
  hmrcRecognitionPublic,
  HMRC_RECOGNITION_BANNER,
} from './hmrc-recognition.js';
import {
  productSurfacePublicStatus,
  paymentsLive,
} from './product-surfaces.js';
import { csrfEnforced } from './csrf.js';
import { loginLockoutConfig } from './login-lockout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function appVersion() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
    ).version;
  } catch {
    return 'unknown';
  }
}

/** @returns {Record<string, unknown>} */
export function buildIntegrityMap() {
  const oauth = oauthConfig();
  const live = process.env.HMRC_ALLOW_LIVE_SUBMIT === '1';
  const version = appVersion();
  return {
    ok: true,
    product: 'Spreadsheet Tax',
    intellectualProperty: 'Lee Hine',
    version,
    appVersion: version,
    publicHttp: false,
    note: 'This map is for code/reviewer use only — not served on the public internet.',
    ...hmrcRecognitionPublic(),
    display: {
      banner: HMRC_RECOGNITION_BANNER,
      siteChrome: '/js/site-chrome.js',
    },
    productType:
      'full MTD bridging (in-year + EOY/BSAS + extras) — sandbox operational build',
    productionSwitch:
      'Set HMRC_OAUTH_ENV=production and Production client id/secret only after HMRC grants Production APIs. Same code path; host from env.',
    mtd: mtdCapabilityMatrix(),
    layers: {
      spreadsheetImportMapping: {
        real: true,
        notes:
          'CSV/XLSX parse → map → payloads → validation; server-owned drafts',
      },
      submitPreviewDouble: {
        real: true,
        isHmrcFiling: false,
        notes:
          'Default public submit path; builds same request shape, no external HMRC call',
      },
      submitSandboxOrLive: {
        real: Boolean(live && !oauth.mock),
        enabled: live,
        oauthMock: oauth.mock,
        notes: live
          ? 'Live flag on — still requires non-mock OAuth token; host is sandbox when HMRC_OAUTH_ENV=sandbox'
          : 'Disabled until HMRC_ALLOW_LIVE_SUBMIT=1',
      },
      sandboxPeriodSources: {
        selfEmployment: true,
        ukProperty: true,
        foreignProperty: true,
        endpoints: [
          'POST /api/hmrc/sandbox-submit',
          'POST /api/hmrc/sandbox-submit-se',
          'POST /api/hmrc/sandbox-submit-uk',
          'POST /api/hmrc/sandbox-submit-foreign',
        ],
        notes:
          'User-restricted sandbox period create; property bodies strip preview-only keys',
      },
      oauth: {
        mockDefault: oauth.mock,
        hasClientCredentials: Boolean(oauth.clientId && oauth.clientSecret),
      },
      businessDetails: {
        real: true,
        endpoint: 'GET /api/hmrc/businesses',
        notes: 'User-restricted list via Business Details (MTD) 2.0',
      },
      obligations: {
        real: true,
        endpoint: 'GET /api/hmrc/obligations',
        notes:
          'User-restricted income & expenditure obligations via Obligations (MTD) 3.0',
      },
      taxLiabilityEstimate: {
        inSoftware: true,
        signpostToHmrc: true,
        notes:
          'P1: trigger/list/retrieve via Individual Calculations (MTD) 8.0 + signpost still available',
      },
      endOfYearAndBsas: {
        real: true,
        notes:
          'P2 routes: annual SE/UK/foreign, BSAS trigger/list/retrieve/adjust, losses, crystallisation obligations, periods of account, final calc types',
      },
      extrasP3: {
        real: true,
        notes: 'ITSA status, BISS, Accounts balance-and-transactions',
      },
      fraudPreventionHeaders: {
        preparedOnOutbound: true,
        connectionMethod: 'WEB_APP_VIA_SERVER',
        keysEmitted: listFraudHeaderKeys(),
        fullHmrcPackValidated: false,
        inventsMissingFields: false,
        notes:
          'Honest omit policy: only real sources. HMRC may return POTENTIALLY_INVALID_HEADERS (e.g. MFA missing). Documented for production approval.',
      },
      authenticatedPracticeWorkspace: {
        real: true,
        path: '/workspace',
        persistence: 'SQLite on DATA_DIR volume',
      },
      publicDemoPracticePortfolio: {
        real: false,
        fictional: true,
        paths: ['/accountant', '/practice', '/api/firms', '/api/clients'],
        notes:
          'In-memory demonstration only; primary CTAs point to authenticated /workspace',
      },
      billing: {
        cardPayments: paymentsLive(),
        planSelectionStored: paymentsLive(),
        note: paymentsLive()
          ? 'STRIPE_SECRET_KEY present — wire checkout + signed webhooks before claiming charged'
          : 'No STRIPE_SECRET_KEY — billing CTAs hidden; select-plan returns 503',
      },
      email: {
        delivered: emailDeliveryMode() !== 'stub',
        provider: emailDeliveryMode(),
        note: 'Set EMAIL_WEBHOOK_URL to deliver; default is stub log only',
      },
      csrf: {
        enforced: csrfEnforced(),
        endpoint: 'GET /api/csrf',
        header: 'X-CSRF-Token',
      },
      loginLockout: loginLockoutConfig(),
      mfa: {
        totpEnroll: true,
        practiceAdminHardRequire: process.env.MFA_REQUIRE_PRACTICE_ADMIN === '1',
        note: 'TOTP enrollment available; practice-admin hard require is env-gated',
      },
      productSurfaces: productSurfacePublicStatus(),
    },
  };
}
