/**
 * Spreadsheet Tax — sales site, bridging app, practice portals, client portal.
 * Intellectual property: Lee Hine (see LICENSE).
 */

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { processLocalFile, processLocalFileIsolated } from './lib/pipeline.js';
import { redisRateLimit } from './lib/redis-client.js';
import { enqueueJob } from './lib/job-queue.js';
import { evaluateCapacityPlatform, isPostgresMode } from './lib/platform-config.js';
import {
  ensureOperationalPostgres,
  mirrorDraftToPostgres,
  mirrorSubmissionAttemptToPostgres,
  mirrorClientToPostgres,
  operationalStoreHealth,
} from './lib/operational-store.js';
import { performProductSubmit } from './lib/live-submit.js';
import { canAttemptLiveHmrc } from './lib/hmrc-client.js';
import { createHmrcClient } from './lib/hmrc-client.js';
import { validateSubmission } from './lib/validation.js';
import {
  listClientsForFirm,
  getClient,
  listFirms,
  listAccountants,
  listWorkflowStatuses,
  allowedClientTransitions,
  updateClientWorkflow,
  ensureDemoData,
} from './lib/practice-store.js';
import {
  createUser,
  findUserByEmail,
  verifyPassword,
  createSession,
  destroySession,
  getSessionUser,
  getSessionIdFromRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
  requireUser,
  listMemberships,
  ensureDemoAuthSeed,
  userCanAccessFirm,
  newId,
  updatePassword,
  createPasswordResetToken,
  consumePasswordResetToken,
  destroyAllSessionsForUser,
  findUserById,
  getUserPreferences,
  setUserPreferences,
} from './lib/auth.js';
import { sendEmail, emailDeliveryMode } from './lib/email.js';
import { listFraudHeaderKeys } from './lib/fraud-headers.js';
import {
  createDraft,
  getDraft,
  listDraftsForUser,
  markDraftSubmitted,
  recordSubmissionAttempt,
  getSubmissionEvidence,
  writeAudit,
  getIdempotentResponse,
  listAuditForFirm,
  listAuditForUser,
  deleteDraft,
  renameDraft,
  exportSubmissionsCsv,
} from './lib/drafts.js';
import { runDeadlineReminders, purgeAnonymousDrafts } from './lib/jobs.js';
import {
  listFirmsForUser,
  listClients as listDbClients,
  getClientRow,
  allowedTransitions as dbAllowedTransitions,
  updateClientStatus,
  listWorkflowStatusCatalog,
  createPortalInvite,
  getClientByPortalToken,
  updateClientDetails,
  exportClientsCsv,
  createFirmInvite,
  acceptFirmInvite,
  getPracticeDashboard,
  deleteClient,
  renameFirm,
  createFirm,
  listClientsPage,
} from './lib/practice-db.js';
import { getDb, getDataDir } from './lib/db.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getActiveConnection,
  revokeConnection,
  oauthConfig,
  isMockAccessToken,
  pingHmrcHelloApplication,
} from './lib/hmrc-oauth.js';
import {
  createSandboxIndividual,
  validateFraudPreventionHeaders,
  sandboxReadiness,
  listBusinessDetails,
  listIncomeExpenditureObligations,
  submitSelfEmploymentPeriodSandbox,
  submitUkPropertyPeriodSandbox,
  submitForeignPropertyPeriodSandbox,
  taxYearFromPeriodStart,
} from './lib/hmrc-sandbox.js';
import {
  ensureFreePlan,
  getUserPlan,
  setUserPlan,
  listPublicPlans,
  PLAN_PROFESSIONAL,
} from './lib/entitlements.js';
import { buildFraudPreventionHeaders } from './lib/fraud-headers.js';
import {
  hmrcRecognitionPublic,
  HMRC_RECOGNITION_BANNER,
} from './lib/hmrc-recognition.js';
import { registerHmrcMtdRoutes } from './routes/hmrc-mtd-routes.js';
import {
  productSurfacePublicStatus,
  paymentsLive,
} from './lib/product-surfaces.js';
import {
  csrfProtectionMiddleware,
  csrfEnforced,
  issueCsrfToken,
  csrfCookieHeader,
} from './lib/csrf.js';
import {
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
  loginLockoutConfig,
} from './lib/login-lockout.js';
import {
  ensureMfaSchema,
  getMfaStatus,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  verifyUserMfa,
  disableMfa,
  practiceAdminRequiresMfa,
} from './lib/mfa-totp.js';
import { ensurePropertyBusinesses } from './lib/ensure-property-businesses.js';
import {
  mtdCapabilityMatrix,
  listFinalDeclarationObligations,
  putSeAnnualSubmission,
  putUkPropertyAnnualSubmission,
  putForeignPropertyAnnualSubmission,
  createBroughtForwardLoss,
  triggerCalculation,
  listCalculations,
  triggerBsas,
  listBsas,
  submitBsasSeAdjustments,
  createTaxLiabilityAdjustment,
  amendSePeriod,
  amendUkPropertyPeriod,
  amendForeignPropertyPeriod,
  createSePeriod,
  createUkPropertyPeriod,
  createForeignPropertyPeriod,
  retrieveSePeriod,
  retrieveUkPropertyPeriod,
  retrieveForeignPropertyPeriod,
  retrieveBsasSelfEmployment,
  retrieveCalculation,
  defaultSeAnnualBody,
  resolveSeAnnualBody,
  periodBodyFromDraft,
  annualBodyFromDraft,
  taxYearFromPeriodId,
  listBusinesses as listBusinessesHmrc,
  submitBsasUkAdjustments,
  submitBsasForeignAdjustments,
  retrievePeriodsOfAccount,
  createOrUpdatePeriodsOfAccount,
} from './lib/hmrc-api.js';
import {
  loadDraftForUser,
  assertJobOperator,
} from './lib/access-control.js';
import { assertProductionBoot } from './lib/production-boot.js';
import {
  recordWorkflowReceipt,
  summariseHmrcResult,
} from './lib/workflow-receipts.js';
import { performWorkflowReadback } from './lib/workflow-readback.js';
import { isKnownWorkflow, KNOWN_WORKFLOWS } from './lib/workflows.js';
import {
  getTaxpayerProfile,
  saveTaxpayerProfile,
  listIncomeSources,
  setIncomeSources,
  mapHmrcBusinessesToSources,
  buildDashboard,
  buildCumulativeReview,
  latestCumulative,
  savePeriodSnapshot,
  buildNilPayload,
  PRACTICE_CLIENT_STATES,
  defaultTaxYear,
} from './lib/taxpayer-journey.js';
import {
  saveSpreadsheetReview,
  getPreviousSpreadsheetCheck,
  addCellComment,
  listCellComments,
} from './lib/spreadsheet-review-store.js';
import {
  getEoyCase,
  updateEoyCase,
  stageToWorkflow,
  EOY_STAGES,
} from './lib/eoy-case.js';
import {
  assertDraftSubmitApproval,
  recordDraftApproval,
  buildEvidencePack,
  newCorrelationId,
  figureHash,
  getLatestApproval,
  APPROVAL_WORDING,
  firmRequiresDualControl,
} from './lib/submission-integrity.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');
const testSpreadsheetsDir = path.join(root, 'test-spreadsheets');
const APP_VERSION = '1.25.0';

/**
 * Serve HTML with site-chrome (HMRC recognition banner/footer) injected once.
 * @param {import('express').Response} res
 * @param {string} filename - file under public/
 */
function sendPublicHtml(res, filename) {
  const file = path.join(publicDir, filename);
  if (!fs.existsSync(file)) {
    return res.status(404).send('Not found');
  }
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/js/site-chrome.js')) {
    const tag = '<script src="/js/site-chrome.js" defer></script>';
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${tag}\n</body>`);
    } else {
      html += `\n${tag}\n`;
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(html);
}

const TEMPLATE_NAME = 'period-summary-template.csv';
const templatePath = path.join(templatesDir, TEMPLATE_NAME);

/** Customer-facing sample files (no internal path names exposed in UI). */
const SAMPLE_FILES = {
  self_employment: '01-self-employment-plumber.csv',
  uk_property: '02-uk-property-landlord.csv',
  foreign_property: '03-foreign-property-spain.csv',
  combined: '04-combined-trade-and-property.csv',
  hairdresser: '05-hairdresser-trade.csv',
};

ensureDemoData();
// Open DB + seed demo user (skip only if explicitly disabled for pure unit isolation)
if (process.env.SKIP_DB_SEED !== '1') {
  try {
    getDb();
    ensureMfaSchema();
    const demo = ensureDemoAuthSeed();
    if (demo?.id) {
      ensureFreePlan(demo.id);
      try {
        setUserPlan(demo.id, PLAN_PROFESSIONAL);
      } catch {
        /* plan table may already have row */
      }
    }
  } catch (e) {
    console.warn('DB init warning:', e instanceof Error ? e.message : e);
  }
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only CSV or Excel files are accepted'), ok);
  },
});

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-App-Version', APP_VERSION);
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
  next();
});
app.use(csrfProtectionMiddleware);

// HTML pages always get recognition chrome (before static, so .html is not raw-served)
app.get(/.*\.html$/i, (req, res, next) => {
  const rel = path.normalize(req.path).replace(/^(\.\.(\/|\\|$))+/, '');
  const base = path.basename(rel);
  if (!base.endsWith('.html')) return next();
  const full = path.join(publicDir, base);
  if (!full.startsWith(publicDir) || !fs.existsSync(full)) return next();
  return sendPublicHtml(res, base);
});

app.use(express.static(publicDir));

/**
 * Explicit template download — reliable Content-Disposition + Content-Type.
 * Prefer this over static mount alone (which can fail on some hosts/browsers).
 */
function sendTemplateDownload(req, res) {
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({
      error: 'Template file not found on server',
      path: TEMPLATE_NAME,
    });
  }
  const body = fs.readFileSync(templatePath);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${TEMPLATE_NAME}"`
  );
  res.setHeader('Content-Length', String(body.length));
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(body);
}

app.get('/download/template', sendTemplateDownload);
app.get('/templates/period-summary-template.csv', sendTemplateDownload);
app.get('/api/template', sendTemplateDownload);

// Static fallback for any other template files
app.use('/templates', express.static(templatesDir));

app.get('/health', (_req, res) => {
  let dbOk = false;
  let clientCount = null;
  try {
    getDb().prepare('SELECT 1 AS x').get();
    dbOk = true;
    clientCount = getDb().prepare(`SELECT COUNT(*) AS c FROM clients`).get().c;
  } catch {
    dbOk = false;
  }
  let dataDir = null;
  try {
    dataDir = getDataDir();
  } catch {
    dataDir = process.env.DATA_DIR || null;
  }
  const capacity = evaluateCapacityPlatform(process.env);
  const store = operationalStoreHealth();
  const ready = dbOk;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'spreadsheet-tax',
    /** Our software release number (semver: major.minor.patch). Not an HMRC receipt/submit id. */
    version: APP_VERSION,
    appVersion: APP_VERSION,
    versionMeaning:
      'Spreadsheet Tax application release (semantic version). Not HMRC-recognised software ID, not a submission reference, not a tax year.',
    ...hmrcRecognitionPublic(),
    bridging: true,
    db: dbOk,
    dbMode: capacity.mode,
    operationalStore: store,
    postgresConfigured: capacity.postgres,
    redisConfigured: capacity.redis,
    capacityGateMet: false,
    capacityGateMetNote:
      'Always false until CAPACITY-REQUIREMENTS acceptance evidence is recorded — never inferred from DATABASE_URL alone',
    capacityRequired: { practices: 200, customers: 800_000 },
    capacityNote:
      'Capacity gate NOT MET until 200 practices + 800k customers proven under load — see docs/CAPACITY-REQUIREMENTS.md',
    productionApiReady: Boolean(
      process.env.HMRC_CLIENT_ID &&
        (process.env.HMRC_OAUTH_ENV === 'production' || process.env.HMRC_BASE_URL)
    ),
    productionApiNote:
      'Production host is env-only (HMRC_OAUTH_ENV / HMRC_BASE_URL). Live traffic still requires real OAuth token + HMRC_ALLOW_LIVE_SUBMIT=1 + approval.',
    oauthMock: oauthConfig().mock,
    liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
    previewOnlyDefault: process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1',
    emailDelivery: emailDeliveryMode(),
    volumeDataDir: dataDir,
    volumeConfigured: Boolean(process.env.DATA_DIR),
    clientRows: clientCount,
    integrity: '/api/integrity',
    fraudHeaderKeys: listFraudHeaderKeys().length,
    scale: {
      clientListPagination: true,
      sqlIndexes: true,
      designTargetClients: 600_000,
      designTargetNote:
        'Capacity design target only — not a load-test claim. SQLite on volume for pilot; Postgres for multi-instance.',
    },
    portals: ['accountant', 'practice', 'client', 'workspace'],
  });
});

/** Kubernetes-style readiness (alias of health for probes) */
app.get('/readyz', (_req, res) => {
  try {
    getDb().prepare('SELECT 1 AS x').get();
    res.status(200).json({
      ready: true,
      version: APP_VERSION,
      appVersion: APP_VERSION,
      ...hmrcRecognitionPublic(),
    });
  } catch {
    res.status(503).json({ ready: false });
  }
});

const MARKETING_VIEW_COOKIE = 'st_mkt_view';

/**
 * Parse a single cookie value from request.
 * @param {import('express').Request} req
 * @param {string} name
 */
function getCookieValue(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('=') || '');
  }
  return null;
}

/**
 * Allow signed-in browsing of marketing pages for a short window (new-tab option).
 * @param {import('express').Response} res
 */
function setMarketingViewCookie(res) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  // 2 hours — long enough to read pricing/audience pages without re-prompting
  res.append(
    'Set-Cookie',
    `${MARKETING_VIEW_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=${2 * 3600}${secure}`
  );
}

/**
 * @param {import('express').Response} res
 */
function clearMarketingViewCookie(res) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${MARKETING_VIEW_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure}`
  );
}

/**
 * Marketing pages: if signed in without marketing-view cookie, warn first.
 * Product app lives under /home, /app, /workspace, etc.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {string} [publicPath]
 */
function sendMarketingHtml(req, res, filename, publicPath) {
  const user = getSessionUser(getSessionIdFromRequest(req));
  if (user) {
    const allowView = getCookieValue(req, MARKETING_VIEW_COOKIE) === '1';
    if (!allowView) {
      const next = publicPath || req.path || '/sales';
      const q = new URLSearchParams({ next, back: '/home' });
      return res.redirect(302, `/leave-to-sales?${q.toString()}`);
    }
  }
  return sendPublicHtml(res, filename);
}

/**
 * Product pages that must not show a usable shell when signed out.
 * Audit P0: signed-out /home /app /workspace looked "live" behind a small warning.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {string} [returnPath]
 */
function sendAppHtml(req, res, filename, returnPath) {
  const user = getSessionUser(getSessionIdFromRequest(req));
  if (!user) {
    const next =
      returnPath ||
      (req.originalUrl && !req.originalUrl.startsWith('/api')
        ? req.originalUrl
        : req.path) ||
      '/home';
    return res.redirect(302, `/signin?next=${encodeURIComponent(next)}`);
  }
  return sendPublicHtml(res, filename);
}

/**
 * Operator / internal tools — not customer product.
 * Requires sign-in; never marketed in primary nav.
 */
function sendOperatorHtml(req, res, filename, returnPath) {
  return sendAppHtml(req, res, filename, returnPath);
}

/** Confirm leave app → marketing (sign out, or stay signed in in a new tab). */
app.get('/leave-to-sales', (_req, res) => {
  sendPublicHtml(res, 'leave-to-sales.html');
});

/**
 * Allow this browser session to view marketing pages while remaining signed in.
 * Used by “open in new tab” — does not end the app session.
 */
app.post('/api/me/allow-marketing-view', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  setMarketingViewCookie(res);
  res.json({
    ok: true,
    note: 'Marketing pages allowed for ~2 hours while you stay signed in.',
  });
});

app.get('/', (req, res) => {
  sendMarketingHtml(req, res, 'sales.html', '/sales');
});
app.get('/sales', (req, res) => {
  sendMarketingHtml(req, res, 'sales.html', '/sales');
});

app.get('/app', (req, res) => {
  sendAppHtml(req, res, 'app.html', req.originalUrl || '/app');
});
app.get('/home', (req, res) => {
  sendAppHtml(req, res, 'home.html', '/home');
});
app.get('/onboarding', (req, res) => {
  sendAppHtml(req, res, 'onboarding.html', '/onboarding');
});
app.get('/records', (req, res) => {
  sendAppHtml(req, res, 'records.html', '/records');
});
app.get('/year-end', (req, res) => {
  sendAppHtml(req, res, 'year-end.html', '/year-end');
});

app.get('/self-employed', (req, res) => {
  sendMarketingHtml(req, res, 'self-employed.html', '/self-employed');
});

app.get('/landlords', (req, res) => {
  sendMarketingHtml(req, res, 'landlords.html', '/landlords');
});

app.get('/professionals', (req, res) => {
  sendMarketingHtml(req, res, 'professionals.html', '/professionals');
});

app.get('/firms', (req, res) => {
  sendMarketingHtml(req, res, 'firms.html', '/firms');
});

/** Demo-only portfolios — still public but must not look like live books (copy in HTML). */
app.get('/accountant', (_req, res) => {
  sendPublicHtml(res, 'accountant.html');
});

app.get('/practice', (_req, res) => {
  sendPublicHtml(res, 'practice.html');
});

app.get('/portal', (_req, res) => {
  sendPublicHtml(res, 'portal.html');
});

app.get('/license', (_req, res) => {
  sendPublicHtml(res, 'license.html');
});

app.get('/legal', (_req, res) => {
  sendPublicHtml(res, 'legal.html');
});

app.get('/pricing', (req, res) => {
  sendMarketingHtml(req, res, 'pricing.html', '/pricing');
});

app.get('/how-it-works', (req, res) => {
  sendMarketingHtml(req, res, 'how-it-works.html', '/how-it-works');
});

app.get('/security', (req, res) => {
  // Public trust page — still marketing surface when signed in
  sendMarketingHtml(req, res, 'security.html', '/security');
});
app.get('/integrity', (_req, res) => {
  sendPublicHtml(res, 'integrity.html');
});
app.get('/privacy', (_req, res) => {
  sendPublicHtml(res, 'privacy.html');
});
app.get('/terms', (_req, res) => {
  sendPublicHtml(res, 'terms.html');
});

app.get('/help', (req, res) => {
  sendMarketingHtml(req, res, 'help.html', '/help');
});

app.get('/templates', (req, res) => {
  sendMarketingHtml(req, res, 'templates.html', '/templates');
});

app.get('/signin', (_req, res) => {
  sendPublicHtml(res, 'signin.html');
});

app.get('/register', (_req, res) => {
  sendPublicHtml(res, 'register.html');
});

app.get('/workspace', (req, res) => {
  sendAppHtml(req, res, 'workspace.html', '/workspace');
});

app.get('/connect-hmrc', (req, res) => {
  sendAppHtml(req, res, 'connect-hmrc.html', '/connect-hmrc');
});
app.get('/mtd', (req, res) => {
  // Internal HMRC diagnostics harness — not a customer product surface
  sendOperatorHtml(req, res, 'mtd.html', '/mtd');
});

app.get('/billing', (req, res) => {
  sendAppHtml(req, res, 'billing.html', '/billing');
});

app.get('/account', (req, res) => {
  sendAppHtml(req, res, 'account.html', '/account');
});

app.get('/history', (req, res) => {
  sendAppHtml(req, res, 'history.html', '/history');
});

app.get('/forgot-password', (_req, res) => {
  sendPublicHtml(res, 'forgot-password.html');
});

app.get('/reset-password', (_req, res) => {
  sendPublicHtml(res, 'reset-password.html');
});

app.get('/accept-invite', (_req, res) => {
  sendPublicHtml(res, 'accept-invite.html');
});

app.get('/admin', (req, res) => {
  sendOperatorHtml(req, res, 'admin.html', '/admin');
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /account
Disallow: /workspace
Disallow: /admin
Disallow: /history
Sitemap: https://spreadsheet-tax-production.up.railway.app/sitemap.xml
`);
});

app.get('/sitemap.xml', (_req, res) => {
  const base =
    process.env.PUBLIC_BASE_URL ||
    'https://spreadsheet-tax-production.up.railway.app';
  const paths = [
    '/',
    '/self-employed',
    '/landlords',
    '/professionals',
    '/firms',
    '/pricing',
    '/how-it-works',
    '/templates',
    '/security',
    '/integrity',
    '/privacy',
    '/terms',
    '/help',
    '/license',
    '/legal',
    '/app',
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths
      .map((p) => `  <url><loc>${base}${p}</loc></url>`)
      .join('\n') +
    `\n</urlset>\n`;
  res.type('application/xml').send(body);
});

app.get('/.well-known/security.txt', (_req, res) => {
  res.type('text/plain').send(`Contact: mailto:lee@4ucic.org
Preferred-Languages: en
Canonical: https://spreadsheet-tax-production.up.railway.app/.well-known/security.txt
Policy: https://spreadsheet-tax-production.up.railway.app/security
`);
});

/**
 * Shared JSON response for a successful import (upload or sample).
 * Always creates a server-owned draft (submit by draftId).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {ReturnType<typeof processLocalFile>} result
 * @param {string} filename
 */
function sendImportResult(req, res, result, filename) {
  const hasAny =
    result.mapped.selfEmployment ||
    result.mapped.ukProperty ||
    result.mapped.foreignProperty.length > 0;

  if (!hasAny) {
    return res.status(422).json({
      error:
        'No self-employment, UK property, or foreign property figures found. Check the template sections.',
      rowCount: result.rowCount,
    });
  }

  const user = getSessionUser(getSessionIdFromRequest(req));
  const payloads = {
    meta: result.payloads.meta,
    selfEmployment: result.payloads.selfEmployment,
    ukProperty: result.payloads.ukProperty,
    foreignProperty: result.payloads.foreignProperty,
  };
  const figures = {
    selfEmployment: result.mapped.selfEmployment?.figures ?? null,
    ukProperty: result.mapped.ukProperty?.figures ?? null,
    foreignProperty: result.mapped.foreignProperty.map((f) => ({
      countryCode: f.countryCode,
      figures: f.figures,
    })),
  };

  let draft = null;
  try {
    draft = createDraft({
      userId: user?.id || null,
      filename,
      payloads,
      summary: result.summary,
      figures,
      validation: result.validation,
    });
    writeAudit({
      userId: user?.id || null,
      action: 'import_created_draft',
      entityType: 'draft',
      entityId: draft.id,
      meta: {
        filename,
        fileSha256: result.fileSha256 || null,
        fileKind: result.fileKind || null,
        objectKey: result.quarantine?.storageKey || null,
        reuploadDiff: Boolean(result.spreadsheetCheck?.reuploadDiff?.hasChanges),
      },
    });
    if (user && result.spreadsheetCheck) {
      try {
        saveSpreadsheetReview({
          userId: user.id,
          draftId: draft.id,
          fileSha256: result.fileSha256 || result.spreadsheetCheck.fileSha256,
          check: result.spreadsheetCheck,
          approved: false,
        });
      } catch (e) {
        console.warn('spreadsheet review persist failed', e);
      }
    }
    // Operational dual-write when DATABASE_URL set (non-blocking)
    mirrorDraftToPostgres(draft).catch((e) =>
      console.warn('Postgres draft mirror failed', e?.message || e)
    );
  } catch (e) {
    console.warn('Draft persist failed (import still returned):', e);
  }

  return res.json({
    ok: true,
    filename,
    draftId: draft?.id || null,
    rowCount: result.rowCount,
    metadata: result.mapped.metadata,
    summary: result.summary,
    validation: result.validation,
    sources: {
      selfEmployment: Boolean(result.mapped.selfEmployment),
      ukProperty: Boolean(result.mapped.ukProperty),
      foreignProperty: result.mapped.foreignProperty.map((f) => f.countryCode),
    },
    figures,
    fieldLinks: result.payloads.linkIndex,
    fileSha256: result.fileSha256 || null,
    fileKind: result.fileKind || null,
    spreadsheetCheck: result.spreadsheetCheck || null,
    // payloads still returned for UI preview; submit prefers draftId
    payloads,
  });
}

/**
 * Upload local spreadsheet → parse → map → quarterly payloads (preview).
 * Customer uploads use isolated Excel path (magic bytes + worker + quarantine).
 */
app.post('/api/import', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'No file uploaded. Use form field "file".' });
      }
      const user = getSessionUser(getSessionIdFromRequest(req));
      const useWorker = process.env.USE_EXCEL_WORKER !== '0';
      const previousCheck = user
        ? getPreviousSpreadsheetCheck(user.id)
        : null;
      const result = useWorker
        ? await processLocalFileIsolated(
            req.file.buffer,
            req.file.originalname,
            { userId: user?.id || null, previousCheck }
          )
        : processLocalFile(req.file.buffer, req.file.originalname, {
            previousCheck,
          });
      return sendImportResult(req, res, result, req.file.originalname);
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Import failed' });
    }
  });
});

/**
 * Load a built-in sample period file so customers can try the flow without preparing a spreadsheet first.
 */
app.post('/api/import/sample', (req, res) => {
  try {
    const kind =
      typeof req.body?.sample === 'string' ? req.body.sample : 'combined';
    const fileName = SAMPLE_FILES[kind] || SAMPLE_FILES.combined;
    const full = path.join(testSpreadsheetsDir, fileName);
    if (!fs.existsSync(full)) {
      return res.status(404).json({
        error: 'Sample period file is not available on this server.',
      });
    }
    const buffer = fs.readFileSync(full);
    const result = processLocalFile(buffer, fileName);
    return sendImportResult(req, res, result, `sample-${kind}.csv`);
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Sample import failed' });
  }
});

/** List sample scenarios for the app UI (customer labels only). */
app.get('/api/samples', (_req, res) => {
  res.json({
    ok: true,
    samples: [
      {
        id: 'self_employment',
        label: 'Self-employed plumber',
        description: 'Trade income and typical expenses for one quarter',
      },
      {
        id: 'uk_property',
        label: 'UK property landlord',
        description: 'Rental income and property costs',
      },
      {
        id: 'foreign_property',
        label: 'Foreign property',
        description: 'Overseas rental income (example: Spain)',
      },
      {
        id: 'combined',
        label: 'Trade + property combined',
        description: 'Self-employment with UK and foreign property in one file',
      },
      {
        id: 'hairdresser',
        label: 'Self-employed hairdresser',
        description: 'Salon trade with sales-style income labels',
      },
    ],
  });
});

/**
 * Gate 0+: default double/preview. Live/sandbox only when explicitly allowed
 * and a user OAuth token (or env token) is present.
 * @param {{ accessToken?: string, mode?: string, req?: import('express').Request }} [opts]
 */
function createSubmitClient(opts = {}) {
  const allowLive = process.env.HMRC_ALLOW_LIVE_SUBMIT === '1';
  if (!allowLive || !opts.accessToken || !canAttemptLiveHmrc({ accessToken: opts.accessToken, allowLiveSubmit: allowLive })) {
    return createHmrcClient({
      mode: 'double',
      accessToken: undefined,
      clientId: undefined,
      clientSecret: undefined,
      req: opts.req || null,
      userId: opts.userId || null,
    });
  }
  // Live path: production vs sandbox host from HMRC_OAUTH_ENV / HMRC_BASE_URL only
  const mode =
    process.env.HMRC_OAUTH_ENV === 'production' || opts.mode === 'production'
      ? 'production'
      : 'sandbox';
  return createHmrcClient({
    mode,
    accessToken: opts.accessToken,
    req: opts.req || null,
    userId: opts.userId || null,
  });
}

/**
 * Rate limit: Redis when REDIS_URL set, else SQLite/in-process.
 * @returns {boolean | Promise<boolean>}
 */
function rateLimit(key, max, windowMs) {
  // Fire Redis path as sync-compat: callers that need async should use rateLimitAsync
  return rateLimitAsync(key, max, windowMs);
}

/** @returns {Promise<boolean>} */
async function rateLimitAsync(key, max, windowMs) {
  try {
    const redisResult = await redisRateLimit(key, max, windowMs);
    if (redisResult !== null && redisResult !== undefined) return redisResult;
  } catch {
    /* fall through to DB */
  }
  const database = getDb();
  const now = Date.now();
  const row = database
    .prepare(`SELECT * FROM rate_limits WHERE key = ?`)
    .get(key);
  if (!row) {
    database
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`
      )
      .run(key, new Date(now).toISOString());
    return true;
  }
  const start = new Date(row.window_start).getTime();
  if (now - start > windowMs) {
    database
      .prepare(
        `UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?`
      )
      .run(new Date(now).toISOString(), key);
    return true;
  }
  if (row.count >= max) return false;
  database
    .prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`)
    .run(key);
  return true;
}

app.post('/api/submit', async (req, res) => {
  try {
    const {
      draftId,
      payloads: clientPayloads,
      nino,
      businessIdSe,
      businessIdUk,
      businessIdForeign,
      taxYear,
      idempotencyKey,
    } = req.body || {};

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]
        : req.socket.remoteAddress) || 'unknown';
    if (!(await rateLimitAsync(`submit:${ip}`, 30, 60_000))) {
      return res.status(429).json({ error: 'Too many submit attempts. Try again shortly.' });
    }

    const user = getSessionUser(getSessionIdFromRequest(req));

    if (idempotencyKey) {
      const prior = getIdempotentResponse(String(idempotencyKey), {
        userId: user?.id || null,
      });
      if (prior) {
        return res.json({
          ok: prior.ok,
          mode: prior.mode,
          draftId: prior.draftId,
          attemptId: prior.attemptId,
          idempotentReplay: true,
          liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
          externalCallMade: prior.mode !== 'double',
          fraudHeadersPrepared: true,
          fraudHeadersSentToHmrc: prior.mode !== 'double',
          previewOnly: prior.mode === 'double',
          results: prior.results,
        });
      }
    }

    let payloads = null;
    let draft = null;
    if (draftId) {
      const loaded = loadDraftForUser(String(draftId), user, { forSubmit: true });
      if (loaded.error || !loaded.draft) {
        return res
          .status(loaded.status || 404)
          .json({ error: loaded.error || 'Draft not found. Import the file again.' });
      }
      draft = loaded.draft;
      payloads = draft.payloads;
    } else if (
      clientPayloads &&
      process.env.ALLOW_CLIENT_PAYLOAD_SUBMIT === '1' &&
      process.env.NODE_ENV !== 'production'
    ) {
      // Explicit opt-in + non-production only — production always requires draftId
      payloads = clientPayloads;
    }

    if (!payloads) {
      return res.status(400).json({
        error:
          'Missing draftId from import. Import a spreadsheet first so the server owns the figures.',
      });
    }

    // Server-enforced figure lock + approval (cannot bypass with raw API)
    let approvalGate = null;
    if (draft) {
      approvalGate = assertDraftSubmitApproval({
        draft,
        user,
        payloads,
        body: req.body || {},
        mode: 'pending',
      });
      if (approvalGate.error) {
        return res.status(approvalGate.status || 403).json({
          error: approvalGate.error,
          code: approvalGate.code || 'APPROVAL_REQUIRED',
          figureHash: approvalGate.figureHash,
        });
      }
    }

    const validation = validateSubmission(payloads, {
      nino,
      businessIdSe,
      businessIdUk,
      businessIdForeign,
      taxYear,
    });
    if (!validation.ready) {
      return res.status(422).json({
        error: 'Check the submission details before continuing.',
        validation,
      });
    }

    // Never allow anonymous external HMRC submit (sandbox or production)
    if (
      process.env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
      !user &&
      process.env.ALLOW_ANONYMOUS_LIVE_SUBMIT !== '1'
    ) {
      // Live path still needs a signed-in user; preview (double) remains allowed
    }

    let accessToken;
    let tokenMode;
    let connectionMock = false;
    if (user && process.env.HMRC_ALLOW_LIVE_SUBMIT === '1') {
      const conn = getActiveConnection(user.id);
      if (conn && !conn.expired && conn.accessToken) {
        if (conn.mock || isMockAccessToken(conn.accessToken)) {
          return res.status(403).json({
            error:
              'HMRC connection is a local mock for UI testing only. Connect real HMRC OAuth before external submit.',
            mockConnection: true,
          });
        }
        accessToken = conn.accessToken;
        tokenMode =
          process.env.HMRC_OAUTH_ENV === 'production' ? 'production' : 'sandbox';
        connectionMock = false;
      }
    }

    // Queue-backed submit when operational flag set (worker requires durable approval)
    if (
      process.env.ASYNC_HMRC_SUBMIT === '1' &&
      draft &&
      user &&
      approvalGate?.ok
    ) {
      const job = await enqueueJob({
        queue: 'hmrc_submit',
        jobType: 'hmrc_submit',
        payload: {
          userApproved: true,
          draftId: draft.id,
          userId: user.id,
          nino: validation.normalized.nino,
          taxYear: validation.normalized.taxYear,
          businessIdSe:
            validation.normalized.businessIdSe || businessIdSe,
          businessIdUk:
            validation.normalized.businessIdUk || businessIdUk,
          businessIdForeign:
            validation.normalized.businessIdForeign || businessIdForeign,
          idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
          supersedesAttemptId: req.body?.supersedesAttemptId || null,
          figureHashAtEnqueue: approvalGate.figureHash || null,
        },
      });
      await mirrorDraftToPostgres(draft).catch(() => {});
      return res.json({
        ok: true,
        queued: true,
        jobId: job.id,
        draftId: draft.id,
        mode: 'queued',
        previewOnly: process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1',
        message:
          'Submission queued for worker — durable approval required; no autonomous HMRC send.',
      });
    }

    // Unified product submit path (same module as worker)
    if (draft) {
      if (
        process.env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
        !user &&
        process.env.ALLOW_ANONYMOUS_LIVE_SUBMIT !== '1'
      ) {
        // live without user will force double inside performProductSubmit when no token
      }
      if (
        process.env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
        accessToken &&
        !user
      ) {
        return res.status(401).json({
          error:
            'Sign in required for HMRC submission. Anonymous live submit is not allowed.',
        });
      }
      if (
        process.env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
        accessToken &&
        draft &&
        !draft.userId &&
        !draft.firmId
      ) {
        return res.status(403).json({
          error:
            'Anonymous drafts can only be used for preview. Sign in, re-import, then submit.',
        });
      }

      const productResult = await performProductSubmit({
        draftId: draft.id,
        userId: user?.id || null,
        body: {
          ...req.body,
          nino: validation.normalized.nino,
          taxYear: validation.normalized.taxYear,
          businessIdSe:
            validation.normalized.businessIdSe || businessIdSe,
          businessIdUk:
            validation.normalized.businessIdUk || businessIdUk,
          businessIdForeign:
            validation.normalized.businessIdForeign || businessIdForeign,
          // Approval already recorded above; pass through cellsApproved if present
          cellsApproved: req.body?.cellsApproved,
          idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
          supersedesAttemptId: req.body?.supersedesAttemptId || null,
        },
        req,
        accessToken: user ? accessToken : null,
        forceDouble: process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1',
      });
      if (productResult.error) {
        return res
          .status(productResult.status || 400)
          .json(productResult);
      }
      if (productResult._mirrorPromise) {
        await productResult._mirrorPromise.catch(() => {});
      }
      const { _mirrorPromise, ...publicBody } = productResult;
      return res.json(publicBody);
    }

    // Rare non-draft path (dev client payloads only — already gated above)
    const client = createSubmitClient({
      accessToken: user ? accessToken : undefined,
      mode: user ? tokenMode : undefined,
      req,
      userId: user?.id || null,
    });
    if (client.mode !== 'double' && process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1') {
      return res.status(403).json({
        error: 'Live HMRC submission is not enabled on this server.',
      });
    }
    const results = await client.submitBundle(payloads, {
      nino: validation.normalized.nino,
      businessIdSe: validation.normalized.businessIdSe || businessIdSe,
      businessIdUk: validation.normalized.businessIdUk || businessIdUk,
      businessIdForeign:
        validation.normalized.businessIdForeign || businessIdForeign,
      taxYear: validation.normalized.taxYear,
    });
    const ok = results.every((r) => r.ok);
    res.json({
      ok,
      mode: client.mode,
      draftId: null,
      results,
      previewOnly: client.mode === 'double',
      externalCallMade: results.some((r) => r.externalCallMade === true),
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Submit failed' });
  }
});

function clientIp(req) {
  return (
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket.remoteAddress) || 'unknown'
  );
}

/** Auth */
app.post('/api/auth/register', async (req, res) => {
  try {
    const regLimit =
      process.env.SPREADSHEET_TAX_NO_LISTEN === '1' ? 500 : 10;
    if (!(await rateLimitAsync(`register:${clientIp(req)}`, regLimit, 60_000))) {
      return res
        .status(429)
        .json({ error: 'Too many registration attempts. Try again shortly.' });
    }
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    if (!email || !password || password.length < 8) {
      return res.status(400).json({
        error: 'Email and password (min 8 characters) are required.',
      });
    }
    if (findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email exists.' });
    }
    const user = createUser({ email, password, name });
    ensureFreePlan(user.id);
    const session = createSession(user.id);
    res.setHeader(
      'Set-Cookie',
      sessionCookieHeader(session.id, session.expiresAt)
    );
    writeAudit({
      userId: user.id,
      action: 'user_registered',
      entityType: 'user',
      entityId: user.id,
    });
    res.status(201).json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!(await rateLimitAsync(`login:${clientIp(req)}`, 20, 60_000))) {
      return res
        .status(429)
        .json({ error: 'Too many login attempts. Try again shortly.' });
    }
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const ip = clientIp(req);
    const emailKey = `email:${email.toLowerCase()}`;
    const ipKey = `ip:${ip}`;
    const lockedEmail = isLoginLocked(emailKey);
    const lockedIp = isLoginLocked(ipKey);
    if (lockedEmail.locked || lockedIp.locked) {
      const ms = Math.max(lockedEmail.remainingMs || 0, lockedIp.remainingMs || 0);
      return res.status(429).json({
        error: 'Account temporarily locked after failed sign-ins. Try again later.',
        code: 'LOGIN_LOCKED',
        retryAfterSec: Math.ceil(ms / 1000),
      });
    }
    const row = findUserByEmail(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      recordLoginFailure(emailKey);
      recordLoginFailure(ipKey);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    ensureMfaSchema();
    const mfa = getMfaStatus(row.id);
    const mfaCode = String(req.body?.mfaCode || req.body?.totp || '').trim();
    if (mfa.enabled) {
      if (!mfaCode) {
        return res.status(401).json({
          error: 'MFA code required.',
          code: 'MFA_REQUIRED',
          mfaRequired: true,
        });
      }
      const v = verifyUserMfa(row.id, mfaCode);
      if (!v.ok) {
        recordLoginFailure(emailKey);
        return res.status(401).json({
          error: v.error || 'Invalid MFA code.',
          code: 'MFA_INVALID',
          mfaRequired: true,
        });
      }
    } else if (practiceAdminRequiresMfa(row.id)) {
      // Soft gate: allow login but flag that enrollment is required
      // (hard block would lock demo practice admins before enroll UX).
    }
    clearLoginFailures(emailKey);
    clearLoginFailures(ipKey);
    // Session rotation: always new session id on login
    destroyAllSessionsForUser(row.id);
    const session = createSession(row.id);
    const csrf = issueCsrfToken(row.id);
    res.setHeader('Set-Cookie', [
      sessionCookieHeader(session.id, session.expiresAt),
      csrfCookieHeader(csrf.token, csrf.expiresAt),
    ]);
    writeAudit({
      userId: row.id,
      action: 'user_login',
      entityType: 'user',
      entityId: row.id,
      meta: { mfa: mfa.enabled },
    });
    res.json({
      ok: true,
      user: { id: row.id, email: row.email, name: row.name },
      mfaEnabled: mfa.enabled,
      csrfToken: csrf.token,
      sessionRotated: true,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Sign-in failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sid = getSessionIdFromRequest(req);
  destroySession(sid);
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    clearSessionCookieHeader(),
    `${MARKETING_VIEW_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure}`,
  ]);
  res.json({ ok: true });
});

app.post('/api/auth/change-password', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (next.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const row = findUserById(user.id);
  if (!row || !verifyPassword(current, row.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  updatePassword(user.id, next);
  const sid = getSessionIdFromRequest(req);
  destroyAllSessionsForUser(user.id, sid);
  writeAudit({
    userId: user.id,
    action: 'password_changed',
    entityType: 'user',
    entityId: user.id,
  });
  res.json({ ok: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  if (!(await rateLimitAsync(`forgot:${clientIp(req)}`, 8, 60_000))) {
    return res
      .status(429)
      .json({ error: 'Too many reset requests. Try again shortly.' });
  }
  const email = String(req.body?.email || '').trim();
  // Always same response to avoid account enumeration
  const created = email ? createPasswordResetToken(email) : null;
  let delivered = false;
  if (created) {
    const base =
      process.env.PUBLIC_BASE_URL ||
      `${req.protocol}://${req.get('host')}`;
    const link = `${base}/reset-password?token=${created.token}`;
    const mail = await sendEmail({
      kind: 'password_reset',
      to: created.email,
      subject: 'Reset your Spreadsheet Tax password',
      body: `Use this link within one hour to reset your password:\n${link}\n\nIf you did not request this, ignore this message.`,
    });
    delivered = Boolean(mail.delivered);
    writeAudit({
      userId: created.userId,
      action: 'password_reset_requested',
      entityType: 'user',
      entityId: created.userId,
      meta: { delivered, provider: mail.provider },
    });
  }
  res.json({
    ok: true,
    // Do not reveal whether the account exists; do reveal that email is stubbed when not delivered
    message: delivered
      ? 'If an account exists for that email, a reset link has been sent.'
      : 'If an account exists for that email, a reset token was created. Email delivery is not configured on this server (check server logs in demo).',
    emailDelivered: delivered,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  const result = consumePasswordResetToken(token, password);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  writeAudit({
    userId: result.userId,
    action: 'password_reset_completed',
    entityType: 'user',
    entityId: result.userId,
  });
  res.json({ ok: true, message: 'Password updated. You can sign in.' });
});

app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(getSessionIdFromRequest(req));
  if (!user) return res.json({ ok: true, user: null });
  ensureFreePlan(user.id);
  const memberships = listMemberships(user.id);
  const plan = getUserPlan(user.id);
  const hmrc = getActiveConnection(user.id);
  res.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    memberships: memberships.map((m) => ({
      firmId: m.firm_id,
      role: m.role,
      firmName: m.firm_name,
    })),
    plan: {
      planId: plan.planId,
      label: plan.label,
      features: plan.features,
    },
    hmrc: hmrc
      ? {
          connected: !hmrc.expired && !hmrc.mock,
          mock: Boolean(hmrc.mock),
          expired: Boolean(hmrc.expired),
          mode: hmrc.mode,
          expiresAt: hmrc.expiresAt,
          label: hmrc.expired
            ? 'Expired'
            : hmrc.mock
              ? 'Mock connection (not HMRC)'
              : hmrc.mode === 'production'
                ? 'HMRC live connected'
                : 'HMRC sandbox connected',
        }
      : { connected: false, mock: false, label: 'Not connected' },
  });
});

/** HMRC OAuth — individual and agent are separate journeys */
app.get('/api/hmrc/connect', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const authorityType = String(
      req.query.authorityType || req.query.authority || 'individual'
    );
    const result = buildAuthorizeUrl({ userId: user.id, authorityType });
    res.json({
      ok: true,
      ...result,
      config: {
        mock: oauthConfig().mock,
        authorityType: result.authorityType,
        agentClientConfigured: Boolean(process.env.HMRC_AGENT_CLIENT_ID),
      },
    });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Could not start HMRC connect',
    });
  }
});

app.get('/api/hmrc/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      return res.status(400).send('Missing code or state');
    }
    const conn = await exchangeCodeForTokens({ code, state });
    writeAudit({
      action: 'hmrc_connected',
      entityType: 'hmrc_connection',
      entityId: conn.id,
      meta: {
        mode: conn.mode,
        mock: conn.mock,
        authorityType: conn.authorityType,
      },
    });
    res.redirect(
      `/connect-hmrc?connected=1&authority=${encodeURIComponent(conn.authorityType || 'individual')}`
    );
  } catch (e) {
    console.error(e);
    res.redirect(
      `/connect-hmrc?error=${encodeURIComponent(e instanceof Error ? e.message : 'connect failed')}`
    );
  }
});

app.post('/api/hmrc/disconnect', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  revokeConnection(user.id);
  writeAudit({
    userId: user.id,
    action: 'hmrc_disconnected',
    entityType: 'user',
    entityId: user.id,
  });
  res.json({ ok: true });
});

app.get('/api/hmrc/status', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const hmrc = getActiveConnection(user.id);
  const oauth = oauthConfig();
  res.json({
    ok: true,
    oauth: {
      mock: oauth.mock,
      mode: oauth.mode,
      hasClientCredentials: Boolean(oauth.clientId && oauth.clientSecret),
      redirectUri: oauth.redirectUri,
    },
    connection: hmrc
      ? {
          // "connected" means a non-mock, non-expired HMRC token
          connected: !hmrc.expired && !hmrc.mock,
          mock: Boolean(hmrc.mock),
          expired: Boolean(hmrc.expired),
          mode: hmrc.mode,
          expiresAt: hmrc.expiresAt,
          label: hmrc.expired
            ? 'Expired'
            : hmrc.mock
              ? 'Mock connection (UI journey only — not HMRC)'
              : 'HMRC OAuth token stored',
        }
      : null,
    honesty: {
      mockOAuthEnabled: oauth.mock,
      liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
      note: oauth.mock
        ? 'Connect uses a local mock callback until HMRC_CLIENT_ID/SECRET are set and HMRC_OAUTH_MOCK is not 1.'
        : 'OAuth uses real HMRC authorize/token endpoints.',
    },
  });
});

/**
 * Sandbox connectivity check (application credentials + Hello World).
 * Does not require a signed-in user tax token. Does not submit tax data.
 */
app.get('/api/hmrc/sandbox-check', async (req, res) => {
  try {
    const result = await pingHmrcHelloApplication();
    const ready = await sandboxReadiness();
    const ok =
      result.openAccess?.ok &&
      result.application?.ok === true &&
      !result.mock;
    res.status(ok ? 200 : 503).json({
      ok,
      ...result,
      readiness: ready,
      storedTestUser: process.env.HMRC_SANDBOX_TEST_USER_ID
        ? {
            userId: process.env.HMRC_SANDBOX_TEST_USER_ID,
            nino: process.env.HMRC_SANDBOX_TEST_NINO || null,
            mtdItId: process.env.HMRC_SANDBOX_TEST_MTD_IT_ID || null,
            // password never returned from this public endpoint
            passwordStored: Boolean(process.env.HMRC_SANDBOX_TEST_USER_PASSWORD),
          }
        : null,
      nextSteps: ok
        ? [
            'Sign in to Spreadsheet Tax',
            'Open /connect-hmrc → Start connect journey',
            'At HMRC sign-in use the sandbox test user ID + password (operator has these)',
            'Then run fraud-header validate and a controlled sandbox period submit',
          ]
        : [
            'Confirm HMRC_CLIENT_ID/SECRET and HMRC_OAUTH_MOCK=0 on Railway',
            'Confirm Hello World is subscribed on the Sandbox application',
            'Confirm redirect URI matches Hub exactly',
          ],
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'sandbox-check failed',
    });
  }
});

/**
 * Create a new HMRC sandbox individual (MTD IT enrolments).
 * Requires signed-in operator. Returns credentials once (HMRC does not re-show).
 */
app.post('/api/hmrc/create-test-user', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const result = await createSandboxIndividual();
    if (!result.ok) {
      return res.status(502).json(result);
    }
    writeAudit({
      userId: user.id,
      action: 'hmrc_test_user_created',
      entityType: 'hmrc_sandbox',
      meta: {
        userId: result.user.userId,
        nino: result.user.nino,
        mtdItId: result.user.mtdItId,
      },
    });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'create-test-user failed',
    });
  }
});

/**
 * Probe fraud-prevention headers against HMRC test validator (sandbox).
 */
app.post('/api/hmrc/validate-fraud-headers', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const result = await validateFraudPreventionHeaders(req, {
      userId: user.id,
    });
    res.status(result.ok ? 200 : 422).json(result);
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'validate-fraud-headers failed',
    });
  }
});

/** List HMRC businesses for the connected user (sandbox/live token). */
// P1 / P2 / P3 full MTD route surface
registerHmrcMtdRoutes(app, {
  requireUser,
  getActiveConnection,
});

app.get('/api/hmrc/businesses', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const conn = getActiveConnection(user.id);
  if (!conn || conn.expired || conn.mock || !conn.accessToken) {
    return res.status(400).json({
      ok: false,
      error: 'Connect real HMRC sandbox OAuth first (non-mock token required).',
    });
  }
  const nino =
    typeof req.query.nino === 'string'
      ? req.query.nino
      : process.env.HMRC_SANDBOX_TEST_NINO || '';
  if (!nino) {
    return res.status(400).json({ ok: false, error: 'nino query required' });
  }
  try {
    const result = await listBusinessDetails({
      accessToken: conn.accessToken,
      nino,
      req,
      userId: user.id,
    });
    res.status(result.ok ? 200 : 502).json(result);
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'businesses failed',
    });
  }
});

/**
 * List income & expenditure obligations (Obligations MTD).
 * Required for HMRC in-year product production access.
 * Query: nino (required), optional typeOfBusiness, businessId, fromDate, toDate, status.
 */
app.get('/api/hmrc/obligations', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const conn = getActiveConnection(user.id);
  if (!conn || conn.expired || conn.mock || !conn.accessToken) {
    return res.status(400).json({
      ok: false,
      error: 'Connect real HMRC sandbox OAuth first (non-mock token required).',
    });
  }
  const nino =
    typeof req.query.nino === 'string'
      ? req.query.nino
      : process.env.HMRC_SANDBOX_TEST_NINO || '';
  if (!nino) {
    return res.status(400).json({ ok: false, error: 'nino query required' });
  }
  try {
    const result = await listIncomeExpenditureObligations({
      accessToken: conn.accessToken,
      nino,
      typeOfBusiness:
        typeof req.query.typeOfBusiness === 'string'
          ? req.query.typeOfBusiness
          : undefined,
      businessId:
        typeof req.query.businessId === 'string' ? req.query.businessId : undefined,
      fromDate:
        typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
      toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      req,
      userId: user.id,
    });
    res.status(result.ok ? 200 : 502).json(result);
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'obligations failed',
    });
  }
});

/**
 * Controlled sandbox period submit (SE / UK property / foreign property).
 * Requires HMRC_ALLOW_LIVE_SUBMIT=1 (still sandbox host when HMRC_OAUTH_ENV=sandbox).
 * Body: { source: 'self_employment'|'uk_property'|'foreign_property', nino, businessId,
 *         taxYear?, draftId? | periodBody?, }
 * Legacy alias: POST /api/hmrc/sandbox-submit-se (source forced to self_employment).
 */
async function handleSandboxPeriodSubmit(req, res, forcedSource) {
  const user = requireUser(req, res);
  if (!user) return;
  if (process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1') {
    return res.status(403).json({
      ok: false,
      error: 'Set HMRC_ALLOW_LIVE_SUBMIT=1 to allow sandbox HMRC HTTP submits.',
    });
  }
  const conn = getActiveConnection(user.id);
  if (!conn || conn.expired || conn.mock || !conn.accessToken) {
    return res.status(400).json({
      ok: false,
      error: 'Real HMRC OAuth connection required.',
    });
  }
  const source = String(
    forcedSource || req.body?.source || 'self_employment'
  ).toLowerCase();
  const allowed = new Set([
    'self_employment',
    'se',
    'uk_property',
    'uk',
    'foreign_property',
    'foreign',
  ]);
  if (!allowed.has(source)) {
    return res.status(400).json({
      ok: false,
      error:
        'source must be self_employment, uk_property, or foreign_property',
    });
  }
  const nino = String(
    req.body?.nino || process.env.HMRC_SANDBOX_TEST_NINO || ''
  )
    .replace(/\s+/g, '')
    .toUpperCase();
  const businessId = String(req.body?.businessId || '');
  if (!nino || !businessId) {
    return res.status(400).json({
      ok: false,
      error: 'nino and businessId required',
    });
  }

  let draft = null;
  let periodBody = req.body?.periodBody || null;
  let taxYear = req.body?.taxYear ? String(req.body.taxYear) : '';

  if (req.body?.draftId) {
    draft = getDraft(String(req.body.draftId));
    if (!draft?.payloads) {
      return res.status(404).json({ ok: false, error: 'Draft not found' });
    }
  }

  const isSe = source === 'self_employment' || source === 'se';
  const isUk = source === 'uk_property' || source === 'uk';
  const isFp = source === 'foreign_property' || source === 'foreign';

  if (draft) {
    if (isSe) {
      if (!draft.payloads.selfEmployment) {
        return res.status(404).json({
          ok: false,
          error: 'Draft has no self-employment payload',
        });
      }
      periodBody = draft.payloads.selfEmployment;
    } else if (isUk) {
      if (!draft.payloads.ukProperty) {
        return res.status(404).json({
          ok: false,
          error: 'Draft has no UK property payload',
        });
      }
      periodBody = draft.payloads.ukProperty;
    } else if (isFp) {
      if (!draft.payloads.foreignProperty) {
        return res.status(404).json({
          ok: false,
          error: 'Draft has no foreign property payload',
        });
      }
      periodBody = draft.payloads.foreignProperty;
    }
    if (!taxYear && draft.payloads.meta?.taxYear) {
      taxYear = String(draft.payloads.meta.taxYear);
    }
    if (!taxYear && draft.payloads.meta?.periodStartDate) {
      taxYear = taxYearFromPeriodStart(draft.payloads.meta.periodStartDate);
    }
  }

  if (!periodBody) {
    return res
      .status(400)
      .json({ ok: false, error: 'periodBody or draftId required' });
  }

  if ((isUk || isFp) && !taxYear) {
    taxYear = taxYearFromPeriodStart(
      periodBody.fromDate || periodBody.periodDates?.periodStartDate
    );
  }

  try {
    let result;
    if (isSe) {
      result = await submitSelfEmploymentPeriodSandbox({
        accessToken: conn.accessToken,
        nino,
        businessId,
        body: periodBody,
        req,
        userId: user.id,
      });
    } else if (isUk) {
      result = await submitUkPropertyPeriodSandbox({
        accessToken: conn.accessToken,
        nino,
        businessId,
        taxYear,
        body: periodBody,
        req,
        userId: user.id,
      });
    } else {
      result = await submitForeignPropertyPeriodSandbox({
        accessToken: conn.accessToken,
        nino,
        businessId,
        taxYear,
        body: periodBody,
        req,
        userId: user.id,
      });
    }
    writeAudit({
      userId: user.id,
      action: `hmrc_sandbox_${isSe ? 'se' : isUk ? 'uk' : 'fp'}_submit`,
      entityType: 'hmrc_submit',
      meta: {
        ok: result.ok,
        status: result.status,
        source: result.source,
        nino: nino.slice(0, 2) + '****',
        businessId,
        taxYear: taxYear || null,
        draftId: draft?.id || null,
      },
    });
    res.status(result.ok ? 200 : 502).json({
      ...result,
      taxYear: taxYear || null,
      draftId: draft?.id || null,
      note: 'Sandbox HTTP only. Fixture/draft data — not a live taxpayer filing.',
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'sandbox submit failed',
    });
  }
}

app.post('/api/hmrc/sandbox-submit', (req, res) =>
  handleSandboxPeriodSubmit(req, res, null)
);
app.post('/api/hmrc/sandbox-submit-se', (req, res) =>
  handleSandboxPeriodSubmit(req, res, 'self_employment')
);
app.post('/api/hmrc/sandbox-submit-uk', (req, res) =>
  handleSandboxPeriodSubmit(req, res, 'uk_property')
);
app.post('/api/hmrc/sandbox-submit-foreign', (req, res) =>
  handleSandboxPeriodSubmit(req, res, 'foreign_property')
);

/**
 * Operator view of stored sandbox test user (password only if DEMO_SHOW_TEST_PASSWORD=1).
 */
app.get('/api/hmrc/sandbox-test-user', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (!process.env.HMRC_SANDBOX_TEST_USER_ID) {
    return res.status(404).json({
      ok: false,
      error: 'No stored sandbox test user. POST /api/hmrc/create-test-user',
    });
  }
  res.json({
    ok: true,
    user: {
      userId: process.env.HMRC_SANDBOX_TEST_USER_ID,
      nino: process.env.HMRC_SANDBOX_TEST_NINO || null,
      mtdItId: process.env.HMRC_SANDBOX_TEST_MTD_IT_ID || null,
      saUtr: process.env.HMRC_SANDBOX_TEST_SA_UTR || null,
      password:
        process.env.DEMO_SHOW_TEST_PASSWORD === '1'
          ? process.env.HMRC_SANDBOX_TEST_USER_PASSWORD || null
          : '(set DEMO_SHOW_TEST_PASSWORD=1 on server to reveal once for pilot)',
    },
    connectSteps: [
      'Sign in to Spreadsheet Tax (your product account)',
      'Open /connect-hmrc and click Start connect journey',
      'At HMRC sandbox login enter the test userId + password',
      'Approve read:self-assessment and write:self-assessment scopes',
      'You return to Spreadsheet Tax with a real sandbox OAuth token',
    ],
  });
});

/** Billing / plans — plan packaging always listed; charges only with Stripe */
app.get('/api/plans', (_req, res) => {
  res.json({
    ok: true,
    plans: listPublicPlans(),
    paymentsLive: paymentsLive(),
    note: paymentsLive()
      ? 'Card checkout available when Stripe is configured.'
      : 'No card charges — billing UI is informational only until STRIPE_SECRET_KEY is set.',
  });
});

app.get('/api/csrf', (req, res) => {
  const user = getSessionUser(getSessionIdFromRequest(req));
  const issued = issueCsrfToken(user?.id || null);
  res.setHeader('Set-Cookie', csrfCookieHeader(issued.token, issued.expiresAt));
  res.json({
    ok: true,
    csrfToken: issued.token,
    header: 'X-CSRF-Token',
    enforced: csrfEnforced(),
  });
});

app.get('/api/product-surfaces', (_req, res) => {
  res.json({ ok: true, ...productSurfacePublicStatus() });
});

/** MFA enrollment (TOTP) — practice admins and any user */
app.get('/api/auth/mfa/status', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({
    ok: true,
    ...getMfaStatus(user.id),
    practiceAdminRequiresMfa: practiceAdminRequiresMfa(user.id),
    mfaRequirePracticeAdminEnv: process.env.MFA_REQUIRE_PRACTICE_ADMIN === '1',
  });
});

app.post('/api/auth/mfa/begin', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const started = beginMfaEnrollment(user.id, user.email);
  writeAudit({
    userId: user.id,
    action: 'mfa_enroll_begin',
    entityType: 'user',
    entityId: user.id,
  });
  res.json({ ok: true, ...started });
});

app.post('/api/auth/mfa/confirm', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const code = String(req.body?.code || req.body?.mfaCode || '');
  const result = confirmMfaEnrollment(user.id, code);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  // Rotate session after privilege/auth change
  destroyAllSessionsForUser(user.id);
  const session = createSession(user.id);
  const csrf = issueCsrfToken(user.id);
  res.setHeader('Set-Cookie', [
    sessionCookieHeader(session.id, session.expiresAt),
    csrfCookieHeader(csrf.token, csrf.expiresAt),
  ]);
  writeAudit({
    userId: user.id,
    action: 'mfa_enrolled',
    entityType: 'user',
    entityId: user.id,
  });
  res.json({ ok: true, enrolledAt: result.enrolledAt, csrfToken: csrf.token });
});

app.post('/api/auth/mfa/disable', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const code = String(req.body?.code || req.body?.mfaCode || '');
  const result = disableMfa(user.id, code);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  destroyAllSessionsForUser(user.id);
  const session = createSession(user.id);
  writeAudit({
    userId: user.id,
    action: 'mfa_disabled',
    entityType: 'user',
    entityId: user.id,
  });
  res.setHeader('Set-Cookie', sessionCookieHeader(session.id, session.expiresAt));
  res.json({ ok: true, sessionRotated: true });
});

app.post('/api/billing/select-plan', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (!paymentsLive()) {
    return res.status(503).json({
      error:
        'Card billing is not available. No payment processor is configured (STRIPE_SECRET_KEY). Plan packaging is experimental only.',
      code: 'BILLING_NOT_LIVE',
      paymentsLive: false,
    });
  }
  try {
    const planId = String(req.body?.planId || 'free');
    const plan = setUserPlan(user.id, planId);
    writeAudit({
      userId: user.id,
      action: 'plan_selected',
      entityType: 'subscription',
      meta: { planId, paymentsLive: true },
    });
    res.json({
      ok: true,
      plan,
      paymentsLive: true,
      note: 'Plan recorded. Card charge path requires completed Stripe checkout (webhook-verified).',
    });
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : 'Could not select plan',
    });
  }
});

app.get('/api/metrics/summary', (req, res) => {
  // Aggregate only — no tax identifiers
  try {
    const database = getDb();
    const users = database.prepare(`SELECT COUNT(*) AS c FROM users`).get().c;
    const drafts = database.prepare(`SELECT COUNT(*) AS c FROM drafts`).get().c;
    const submits = database
      .prepare(`SELECT COUNT(*) AS c FROM submission_attempts`)
      .get().c;
    const ctas = database.prepare(`SELECT COUNT(*) AS c FROM cta_events`).get().c;
    res.json({
      ok: true,
      users: Number(users),
      drafts: Number(drafts),
      submissionAttempts: Number(submits),
      ctaEvents: Number(ctas),
    });
  } catch {
    res.json({ ok: true, users: 0, drafts: 0, submissionAttempts: 0, ctaEvents: 0 });
  }
});

/** Anonymous CTA analytics — no tax data */
app.post('/api/analytics/cta', (req, res) => {
  try {
    const eventName = String(req.body?.event || '').slice(0, 80);
    if (!eventName) {
      return res.status(400).json({ error: 'event required' });
    }
    getDb()
      .prepare(
        `INSERT INTO cta_events (id, event_name, path, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        newId(),
        eventName,
        String(req.body?.path || '').slice(0, 200) || null,
        req.body?.meta ? JSON.stringify(req.body.meta).slice(0, 1000) : null,
        new Date().toISOString()
      );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'analytics failed' });
  }
});

/** Ops jobs (protected by simple shared secret for pilot) */
app.post('/api/jobs/run', async (req, res) => {
  const secret =
    process.env.JOBS_SECRET ||
    (process.env.NODE_ENV === 'production' ? null : 'dev-jobs-secret');
  if (!secret) {
    return res.status(503).json({
      error: 'JOBS_SECRET is not configured on this server.',
    });
  }
  if (req.headers['x-jobs-secret'] !== secret && req.body?.secret !== secret) {
    return res.status(403).json({ error: 'Jobs secret required' });
  }
  const job = String(req.body?.job || '');
  if (job === 'deadline_reminders') {
    return res.json(
      await runDeadlineReminders(Number(req.body?.withinDays) || 14)
    );
  }
  if (job === 'purge_anonymous_drafts') {
    return res.json(purgeAnonymousDrafts(Number(req.body?.maxAgeHours) || 48));
  }
  res.status(400).json({
    error: 'Unknown job',
    jobs: ['deadline_reminders', 'purge_anonymous_drafts'],
  });
});

/** Signed-in practice can trigger deadline reminders for their firm book only */
app.post('/api/me/jobs/deadline-reminders', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const memberships = listMemberships(user.id);
  if (!memberships.length) {
    return res.status(403).json({ error: 'No firm membership.' });
  }
  const firmId =
    typeof req.body?.firmId === 'string' && req.body.firmId
      ? req.body.firmId
      : memberships[0].firm_id;
  const denied = assertJobOperator(user.id, firmId);
  if (denied) {
    return res.status(denied.status).json({ error: denied.error });
  }
  const result = await runDeadlineReminders(Number(req.body?.withinDays) || 14, {
    firmId,
  });
  writeAudit({
    firmId,
    userId: user.id,
    action: 'deadline_reminders_run',
    meta: {
      count: result.count,
      deliveredCount: result.deliveredCount,
      firmId,
    },
  });
  res.json(result);
});

app.post('/api/me/firms/:firmId/invites', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = createFirmInvite({
    firmId: req.params.firmId,
    email: String(req.body?.email || ''),
    role: String(req.body?.role || 'accountant'),
    invitedBy: user.id,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  const base =
    process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base}${result.path}`;
  const mail = await sendEmail({
    kind: 'firm_invite',
    to: result.email,
    subject: 'You are invited to a Spreadsheet Tax practice',
    body: `You have been invited as ${result.role}. Accept here:\n${url}`,
  });
  writeAudit({
    firmId: req.params.firmId,
    userId: user.id,
    action: 'firm_invite_created',
    meta: {
      email: result.email,
      role: result.role,
      delivered: mail.delivered,
      provider: mail.provider,
    },
  });
  res.status(201).json({
    ok: true,
    ...result,
    url,
    emailDelivered: mail.delivered,
    emailProvider: mail.provider,
    emailNote: mail.delivered
      ? 'Invite email sent.'
      : 'Invite link created. Email was not delivered (stub mode) — copy the URL to share.',
  });
});

app.post('/api/me/firm-invites/accept', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const token = String(req.body?.token || '');
  const result = acceptFirmInvite(token, user.id, user.email);
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: result.firmId,
    userId: user.id,
    action: 'firm_invite_accepted',
    meta: { role: result.role },
  });
  res.json({ ok: true, ...result });
});

app.get('/api/me/audit', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const firmId =
    typeof req.query.firmId === 'string' ? req.query.firmId : null;
  if (firmId) {
    if (!userCanAccessFirm(user.id, firmId)) {
      return res.status(403).json({ error: 'Not allowed for this firm.' });
    }
    return res.json({ ok: true, events: listAuditForFirm(firmId, 80) });
  }
  res.json({ ok: true, events: listAuditForUser(user.id, 40) });
});

// ——— Unified taxpayer journey (SE + UK + foreign) ———

app.get('/api/me/taxpayer-profile', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, profile: getTaxpayerProfile(user.id) });
});

app.put('/api/me/taxpayer-profile', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = saveTaxpayerProfile(user.id, {
    manageMode: req.body?.manageMode,
    taxYear: req.body?.taxYear,
    periodType: req.body?.periodType,
    onboardingComplete: req.body?.onboardingComplete,
    meta: req.body?.meta,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    userId: user.id,
    action: 'taxpayer_profile_saved',
    entityType: 'user',
    entityId: user.id,
  });
  res.json(result);
});

app.get('/api/me/income-sources', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, sources: listIncomeSources(user.id) });
});

app.put('/api/me/income-sources', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const sources = setIncomeSources(user.id, req.body?.sources || []);
  writeAudit({
    userId: user.id,
    action: 'income_sources_saved',
    entityType: 'user',
    entityId: user.id,
    meta: { count: sources.length },
  });
  res.json({ ok: true, sources });
});

/** Pull businesses from HMRC into proposed income sources (user still confirms). */
app.post('/api/me/income-sources/from-hmrc', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const profile = getTaxpayerProfile(user.id);
  const nino =
    String(req.body?.nino || profile.meta?.nino || '')
      .replace(/\s+/g, '')
      .toUpperCase() || null;
  if (!nino) {
    // Prefer stored preferences identifiers
    const prefs = getUserPreferences(user.id);
    const n2 = prefs?.identifiers?.nino;
    if (!n2) {
      return res.status(400).json({
        error:
          'NINO needed once to load HMRC businesses (save in account preferences or body). After connect, prefer OAuth path.',
      });
    }
  }
  const ninoFinal =
    nino ||
    String(getUserPreferences(user.id)?.identifiers?.nino || '')
      .replace(/\s+/g, '')
      .toUpperCase();
  try {
    const conn = getActiveConnection(user.id);
    if (!conn?.accessToken || conn.mock) {
      return res.status(400).json({
        error: 'Connect real HMRC OAuth first so we can list your businesses.',
      });
    }
    const result = await listBusinessesHmrc({
      accessToken: conn.accessToken,
      nino: ninoFinal,
      req,
      userId: user.id,
    });
    if (!result.ok) {
      return res.status(502).json({
        ok: false,
        error: result.body?.message || 'HMRC businesses failed',
        hmrcStatus: result.status,
      });
    }
    const list =
      result.body?.listOfBusinesses || result.body?.businesses || [];
    const proposed = mapHmrcBusinessesToSources(list);
    const sources = setIncomeSources(user.id, proposed);
    // store nino in profile meta (not log full)
    saveTaxpayerProfile(user.id, {
      meta: { ...(getTaxpayerProfile(user.id).meta || {}), nino: ninoFinal },
    });
    res.json({ ok: true, sources, hmrcCount: list.length });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : 'from-hmrc failed',
    });
  }
});

app.get('/api/me/dashboard', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  let obligations = null;
  try {
    const profile = getTaxpayerProfile(user.id);
    const nino =
      profile.meta?.nino ||
      getUserPreferences(user.id)?.identifiers?.nino ||
      null;
    const conn = getActiveConnection(user.id);
    if (nino && conn?.accessToken && !conn.mock) {
      const obl = await listIncomeExpenditureObligations({
        accessToken: conn.accessToken,
        nino: String(nino).replace(/\s+/g, '').toUpperCase(),
        req,
        userId: user.id,
      });
      if (obl.ok) obligations = obl.body;
    }
  } catch {
    /* dashboard still works offline */
  }
  const dash = buildDashboard(user.id, { obligations });
  res.json({ ok: true, ...dash });
});

/**
 * Cumulative quarterly review for a draft (this quarter vs YTD).
 */
app.get('/api/me/drafts/:draftId/cumulative-review', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const loaded = loadDraftForUser(req.params.draftId, user);
  if (loaded.error || !loaded.draft) {
    return res
      .status(loaded.status || 404)
      .json({ error: loaded.error || 'Draft not found' });
  }
  const prev = latestCumulative(
    user.id,
    loaded.draft.payloads?.meta?.taxYear || defaultTaxYear()
  );
  const review = buildCumulativeReview(
    loaded.draft.payloads,
    prev?.cumulative || null
  );
  res.json({
    ok: true,
    draftId: loaded.draft.id,
    review,
    previousPeriodEnd: prev?.periodEnd || null,
  });
});

/** Snapshot cumulative after successful submit (preview or live). */
app.post('/api/me/drafts/:draftId/snapshot', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const loaded = loadDraftForUser(req.params.draftId, user);
  if (loaded.error || !loaded.draft) {
    return res
      .status(loaded.status || 404)
      .json({ error: loaded.error || 'Draft not found' });
  }
  const prev = latestCumulative(
    user.id,
    loaded.draft.payloads?.meta?.taxYear || defaultTaxYear()
  );
  const snap = savePeriodSnapshot(user.id, loaded.draft.payloads, {
    draftId: loaded.draft.id,
    attemptId: req.body?.attemptId || null,
    previousCumulative: prev?.cumulative || null,
  });
  res.json({ ok: true, snapshotId: snap.id, cumulative: snap.cumulative });
});

/** Nil update payload for a source (zero activity). */
app.post('/api/me/nil-update', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const type = String(req.body?.type || 'self_employment');
  const payloads = buildNilPayload(type, {
    taxYear: req.body?.taxYear || defaultTaxYear(),
    periodStartDate: req.body?.periodStartDate || '2024-04-06',
    periodEndDate: req.body?.periodEndDate || '2024-07-05',
    countryCode: req.body?.countryCode,
  });
  const draft = createDraft({
    userId: user.id,
    filename: `nil-${type}.json`,
    payloads,
    summary: {
      taxYear: payloads.meta.taxYear,
      periodStart: payloads.meta.periodStartDate,
      periodEnd: payloads.meta.periodEndDate,
      totals: { totalIncome: 0, totalExpenses: 0, net: 0 },
      sourceCount: 1,
    },
    validation: { ready: true, errors: [], warnings: [] },
  });
  const review = buildCumulativeReview(
    payloads,
    latestCumulative(user.id, payloads.meta.taxYear)?.cumulative
  );
  res.status(201).json({
    ok: true,
    draftId: draft.id,
    payloads,
    review,
    note: 'Nil update ready for review — confirm business and dates before send.',
  });
});

app.get('/api/practice/workflow-states', (_req, res) => {
  res.json({ ok: true, states: PRACTICE_CLIENT_STATES });
});

/**
 * End-of-year guided tax-return case (product stages, not API checklist).
 */
app.get('/api/me/eoy-case', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const taxYear =
    typeof req.query.taxYear === 'string' && req.query.taxYear
      ? req.query.taxYear
      : defaultTaxYear();
  const eoy = getEoyCase(user.id, taxYear);
  res.json({
    ok: true,
    case: eoy,
    stageWorkflow: stageToWorkflow(eoy.stageId),
    stages: EOY_STAGES,
  });
});

app.put('/api/me/eoy-case', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const patch = {
    taxYear:
      typeof req.body?.taxYear === 'string' && req.body.taxYear
        ? req.body.taxYear
        : undefined,
    stageId:
      typeof req.body?.stageId === 'string' ? req.body.stageId : undefined,
    completeCurrent: Boolean(req.body?.completeCurrent),
    note: typeof req.body?.note === 'string' ? req.body.note : undefined,
  };
  if (patch.stageId && !EOY_STAGES.some((s) => s.id === patch.stageId)) {
    return res.status(400).json({
      error: 'Unknown stage',
      known: EOY_STAGES.map((s) => s.id),
    });
  }
  const eoy = updateEoyCase(user.id, patch);
  writeAudit({
    userId: user.id,
    action: 'eoy_case_updated',
    entityType: 'eoy_case',
    entityId: `${user.id}:${eoy.taxYear}`,
    meta: { stageId: eoy.stageId, taxYear: eoy.taxYear },
  });
  res.json({
    ok: true,
    case: eoy,
    stageWorkflow: stageToWorkflow(eoy.stageId),
  });
});

/** Preparer/reviewer comments on a cell or range */
app.get('/api/me/drafts/:draftId/cell-comments', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const loaded = loadDraftForUser(req.params.draftId, user);
  if (loaded.error) {
    return res.status(loaded.status || 404).json({ error: loaded.error });
  }
  res.json({ ok: true, comments: listCellComments(req.params.draftId) });
});

app.post('/api/me/drafts/:draftId/cell-comments', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const loaded = loadDraftForUser(req.params.draftId, user);
  if (loaded.error) {
    return res.status(loaded.status || 404).json({ error: loaded.error });
  }
  const result = addCellComment({
    userId: user.id,
    draftId: req.params.draftId,
    cellRef: String(req.body?.cellRef || ''),
    sheet: req.body?.sheet,
    rangeRef: req.body?.rangeRef,
    body: String(req.body?.body || ''),
    authorRole: String(req.body?.authorRole || 'preparer'),
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    userId: user.id,
    action: 'cell_comment_added',
    entityType: 'draft',
    entityId: req.params.draftId,
    meta: { cellRef: req.body?.cellRef },
  });
  res.status(201).json(result);
});

app.post('/api/me/drafts/:draftId/approve-spreadsheet', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const loaded = loadDraftForUser(req.params.draftId, user);
  if (loaded.error || !loaded.draft) {
    return res
      .status(loaded.status || 404)
      .json({ error: loaded.error || 'Draft not found' });
  }
  if (loaded.draft.spreadsheetCheck?.approvalInvalidated) {
    return res.status(409).json({
      error:
        'Spreadsheet changed since last review — re-check cells before approving.',
    });
  }
  const dual =
    Boolean(loaded.draft.firmId) && firmRequiresDualControl(loaded.draft.firmId);
  const recorded = recordDraftApproval({
    userId: user.id,
    draftId: loaded.draft.id,
    payloads: loaded.draft.payloads,
    fileSha256:
      req.body?.spreadsheetCheck?.fileSha256 ||
      req.body?.fileSha256 ||
      null,
    check: req.body?.spreadsheetCheck || null,
    firmId: loaded.draft.firmId,
    dualControl: dual,
  });
  if (recorded.error) {
    return res.status(recorded.status || 403).json({ error: recorded.error });
  }
  writeAudit({
    userId: user.id,
    action: 'spreadsheet_cells_approved',
    entityType: 'draft',
    entityId: loaded.draft.id,
    meta: { figureHash: recorded.figureHash, dualControl: dual },
  });
  res.json({
    ok: true,
    approvedAt: recorded.approvedAt,
    figureHash: recorded.figureHash,
    wording: APPROVAL_WORDING,
  });
});

/** Attach import to client (practice) */
app.post('/api/me/clients/:clientId/import', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    const user = requireUser(req, res);
    if (!user) return;
    try {
      const client = getClientRow(req.params.clientId);
      if (!client || !userCanAccessFirm(user.id, client.firmId)) {
        return res.status(403).json({ error: 'Not allowed for this client.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }
      const result = processLocalFile(req.file.buffer, req.file.originalname);
      // temporarily bind user for draft ownership
      const payloads = {
        meta: result.payloads.meta,
        selfEmployment: result.payloads.selfEmployment,
        ukProperty: result.payloads.ukProperty,
        foreignProperty: result.payloads.foreignProperty,
      };
      const draft = createDraft({
        userId: user.id,
        clientId: client.id,
        firmId: client.firmId,
        filename: req.file.originalname,
        payloads,
        summary: result.summary,
        figures: {
          selfEmployment: result.mapped.selfEmployment?.figures ?? null,
          ukProperty: result.mapped.ukProperty?.figures ?? null,
          foreignProperty: result.mapped.foreignProperty.map((f) => ({
            countryCode: f.countryCode,
            figures: f.figures,
          })),
        },
        validation: result.validation,
      });
      writeAudit({
        firmId: client.firmId,
        userId: user.id,
        action: 'client_import',
        entityType: 'draft',
        entityId: draft.id,
        meta: { clientId: client.id },
      });
      res.json({
        ok: true,
        draftId: draft.id,
        clientId: client.id,
        summary: result.summary,
        validation: result.validation,
        redirectApp: `/app?draftId=${encodeURIComponent(draft.id)}`,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        error: e instanceof Error ? e.message : 'Import failed',
      });
    }
  });
});

app.get('/api/drafts', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, drafts: listDraftsForUser(user.id) });
});

app.get('/api/drafts/:draftId', (req, res) => {
  const user = getSessionUser(getSessionIdFromRequest(req));
  const loaded = loadDraftForUser(req.params.draftId, user);
  if (loaded.error || !loaded.draft) {
    return res
      .status(loaded.status || 404)
      .json({ error: loaded.error || 'Draft not found' });
  }
  res.json({ ok: true, draft: loaded.draft });
});

app.delete('/api/drafts/:draftId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = deleteDraft(req.params.draftId, user.id);
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    userId: user.id,
    action: 'draft_deleted',
    entityType: 'draft',
    entityId: req.params.draftId,
  });
  res.json({ ok: true });
});

app.patch('/api/drafts/:draftId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = renameDraft(
    req.params.draftId,
    user.id,
    String(req.body?.filename || '')
  );
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    userId: user.id,
    action: 'draft_renamed',
    entityType: 'draft',
    entityId: req.params.draftId,
  });
  res.json({ ok: true, draft: result.draft });
});

app.get('/api/me/preferences', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, preferences: getUserPreferences(user.id) });
});

app.put('/api/me/preferences', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const preferences = setUserPreferences(user.id, {
    emailReminders: req.body?.emailReminders,
    emailProduct: req.body?.emailProduct,
    identifiers: req.body?.identifiers,
  });
  writeAudit({
    userId: user.id,
    action: 'preferences_updated',
    entityType: 'user',
    entityId: user.id,
  });
  res.json({ ok: true, preferences });
});

/** Authenticated practice (persistent) */
app.get('/api/me/firms', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, firms: listFirmsForUser(user.id) });
});

app.post('/api/me/firms', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = createFirm({
    userId: user.id,
    name: String(req.body?.name || ''),
    type: req.body?.type,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: result.firm.id,
    userId: user.id,
    action: 'firm_created',
    entityType: 'firm',
    entityId: result.firm.id,
  });
  res.status(201).json({ ok: true, firm: result.firm, role: result.role });
});

app.patch('/api/me/firms/:firmId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = renameFirm({
    firmId: req.params.firmId,
    userId: user.id,
    name: String(req.body?.name || ''),
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: req.params.firmId,
    userId: user.id,
    action: 'firm_renamed',
    entityType: 'firm',
    entityId: req.params.firmId,
    meta: { name: result.firm?.name },
  });
  res.json({ ok: true, firm: result.firm });
});

app.delete('/api/me/clients/:clientId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = deleteClient({
    clientId: req.params.clientId,
    userId: user.id,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: result.client.firmId,
    userId: user.id,
    action: 'client_deleted',
    entityType: 'client',
    entityId: req.params.clientId,
  });
  res.json({ ok: true });
});

app.get('/api/me/clients', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const firmId =
    typeof req.query.firmId === 'string' ? req.query.firmId : null;
  if (!firmId || !userCanAccessFirm(user.id, firmId)) {
    return res.status(400).json({ error: 'Valid firmId required for your membership.' });
  }
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const needsAction =
    req.query.needsAction === '1' || req.query.needsAction === 'true';
  const limit = req.query.limit != null ? Number(req.query.limit) : 50;
  const offset = req.query.offset != null ? Number(req.query.offset) : 0;
  // Full dump only when explicitly requested (exports / small books)
  if (req.query.all === '1' || req.query.all === 'true') {
    const clients = listDbClients(firmId);
    return res.json({
      ok: true,
      clients,
      total: clients.length,
      limit: clients.length,
      offset: 0,
      hasMore: false,
    });
  }
  const page = listClientsPage({
    firmId,
    q,
    status,
    needsAction,
    limit,
    offset,
  });
  res.json({ ok: true, ...page });
});

app.get('/api/me/practice-dashboard', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const firmId =
    typeof req.query.firmId === 'string' ? req.query.firmId : null;
  if (!firmId || !userCanAccessFirm(user.id, firmId)) {
    return res
      .status(400)
      .json({ error: 'Valid firmId required for your membership.' });
  }
  res.json({ ok: true, dashboard: getPracticeDashboard(firmId) });
});

app.patch('/api/me/clients/:clientId/workflow', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = updateClientStatus({
    clientId: req.params.clientId,
    userId: user.id,
    status: typeof req.body?.status === 'string' ? req.body.status : '',
    note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : null,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: result.client.firmId,
    userId: user.id,
    action: 'workflow_updated',
    entityType: 'client',
    entityId: result.client.id,
    meta: { status: result.client.status },
  });
  res.json({ ok: true, ...result });
});

app.get('/api/me/workflow-statuses', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, statuses: listWorkflowStatusCatalog() });
});

app.post('/api/me/clients', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const firmId = String(req.body?.firmId || '');
  const name = String(req.body?.name || '').trim();
  if (!firmId || !userCanAccessFirm(user.id, firmId)) {
    return res.status(403).json({ error: 'Not allowed for this firm.' });
  }
  if (!name) return res.status(400).json({ error: 'Client name required.' });
  const id = newId();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
       VALUES (?, ?, ?, 'awaiting_records', ?, ?, 1, ?, ?)`
    )
    .run(id, firmId, name, user.id, req.body?.dueDate || null, now, now);
  writeAudit({
    firmId,
    userId: user.id,
    action: 'client_created',
    entityType: 'client',
    entityId: id,
  });
  const created = getClientRow(id);
  mirrorClientToPostgres(created).catch(() => {});
  res.status(201).json({ ok: true, client: created });
});

/**
 * Customer/practice year-end and correction workflows.
 * Same HMRC adapter as /api/hmrc/mtd/* — records immutable receipt per step.
 */
app.post('/api/workflows/run', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const workflow = String(req.body?.workflow || '');
  const nino = String(req.body?.nino || '')
    .replace(/\s+/g, '')
    .toUpperCase();
  const taxYear = String(req.body?.taxYear || '2024-25');
  if (!workflow) {
    return res.status(400).json({ error: 'workflow required' });
  }
  // Known-name check BEFORE preview success (never invent success for typos)
  if (!isKnownWorkflow(workflow)) {
    return res.status(400).json({
      error: 'Unknown workflow',
      known: KNOWN_WORKFLOWS,
    });
  }
  if (!nino) {
    return res.status(400).json({ error: 'nino required' });
  }

  const live = process.env.HMRC_ALLOW_LIVE_SUBMIT === '1';
  const conn = live ? getActiveConnection(user.id) : null;
  const canExternal =
    live &&
    conn &&
    !conn.expired &&
    !conn.mock &&
    conn.accessToken &&
    !isMockAccessToken(conn.accessToken);

  /** @type {object} */
  let hmrcResult = null;
  let mode = 'double';

  try {
    if (!canExternal) {
      // Preview receipt only — same shape, no HMRC HTTP
      const previewReadback = {
        attempted: false,
        note: 'Preview mode — no HMRC retrieve/readback HTTP',
      };
      const receipt = recordWorkflowReceipt({
        userId: user.id,
        workflow,
        mode: 'double',
        ok: true,
        request: { workflow, nino: nino.slice(0, 2) + '****', taxYear },
        response: {
          preview: true,
          message:
            'Preview only — not sent to HMRC. Connect OAuth and set HMRC_ALLOW_LIVE_SUBMIT=1 for external calls.',
        },
        readback: previewReadback,
      });
      writeAudit({
        userId: user.id,
        action: `workflow_${workflow}_preview`,
        entityType: 'workflow',
        meta: { receiptId: receipt.receiptId },
      });
      return res.json({
        ok: true,
        workflow,
        mode: 'double',
        previewOnly: true,
        receiptId: receipt.receiptId,
        readback: previewReadback,
        message: receipt.receiptId
          ? 'Preview receipt stored. No HMRC call made.'
          : 'Preview complete.',
      });
    }

    mode = conn.mode || 'sandbox';
    const o = {
      accessToken: conn.accessToken,
      nino,
      req,
      userId: user.id,
      taxYear,
    };

    // Optional draft body for period creates
    let draftBody = null;
    if (req.body?.draftId) {
      const loaded = loadDraftForUser(String(req.body.draftId), user, {
        forSubmit: true,
      });
      if (loaded.error || !loaded.draft) {
        return res
          .status(loaded.status || 403)
          .json({ error: loaded.error || 'Draft not allowed' });
      }
      draftBody = loaded.draft;
    }

    switch (workflow) {
      case 'se_period': {
        if (!req.body?.businessIdSe) {
          return res.status(400).json({ error: 'businessIdSe required' });
        }
        const body =
          req.body?.body ||
          periodBodyFromDraft(draftBody, 'self_employment') ||
          {
            periodDates: {
              periodStartDate: '2024-04-06',
              periodEndDate: '2024-07-05',
            },
            periodIncome: { turnover: 1, other: 0 },
            periodExpenses: { consolidatedExpenses: 0 },
          };
        hmrcResult = await createSePeriod({
          ...o,
          businessId: req.body.businessIdSe,
          body,
        });
        break;
      }
      case 'uk_period': {
        if (!req.body?.businessIdUk) {
          return res.status(400).json({ error: 'businessIdUk required' });
        }
        const body =
          req.body?.body ||
          periodBodyFromDraft(draftBody, 'uk_property') || {
            fromDate: '2024-04-06',
            toDate: '2024-07-05',
            ukOtherProperty: {
              income: { periodAmount: 1 },
              expenses: { consolidatedExpenses: 0 },
            },
          };
        hmrcResult = await createUkPropertyPeriod({
          ...o,
          businessId: req.body.businessIdUk,
          taxYear:
            taxYear ||
            taxYearFromPeriodStart(body.fromDate || body.periodDates?.periodStartDate),
          body,
        });
        break;
      }
      case 'fp_period': {
        if (!req.body?.businessIdForeign) {
          return res.status(400).json({ error: 'businessIdForeign required' });
        }
        const body =
          req.body?.body ||
          periodBodyFromDraft(draftBody, 'foreign_property') || {
            fromDate: '2024-04-06',
            toDate: '2024-07-05',
            foreignProperty: [
              {
                countryCode: 'ESP',
                income: { rentIncome: { rentAmount: 1 }, foreignTaxCreditRelief: false },
                expenses: { consolidatedExpenses: 0 },
              },
            ],
          };
        hmrcResult = await createForeignPropertyPeriod({
          ...o,
          businessId: req.body.businessIdForeign,
          taxYear:
            taxYear ||
            taxYearFromPeriodStart(body.fromDate || body.periodDates?.periodStartDate),
          body,
        });
        break;
      }
      case 'final_obligations':
        hmrcResult = await listFinalDeclarationObligations(o);
        break;
      case 'se_annual':
        if (!req.body?.businessIdSe) {
          return res.status(400).json({ error: 'businessIdSe required' });
        }
        hmrcResult = await putSeAnnualSubmission({
          ...o,
          businessId: req.body.businessIdSe,
          body: resolveSeAnnualBody(
            req.body?.body ||
              annualBodyFromDraft(draftBody, 'se') ||
              defaultSeAnnualBody()
          ),
        });
        break;
      case 'uk_annual':
        if (!req.body?.businessIdUk) {
          return res.status(400).json({ error: 'businessIdUk required' });
        }
        hmrcResult = await putUkPropertyAnnualSubmission({
          ...o,
          businessId: req.body.businessIdUk,
          body:
            req.body?.body ||
            annualBodyFromDraft(draftBody, 'uk') || {
              ukOtherProperty: { adjustments: {} },
            },
        });
        break;
      case 'fp_annual':
        if (!req.body?.businessIdForeign) {
          return res.status(400).json({ error: 'businessIdForeign required' });
        }
        hmrcResult = await putForeignPropertyAnnualSubmission({
          ...o,
          businessId: req.body.businessIdForeign,
          body:
            req.body?.body ||
            annualBodyFromDraft(draftBody, 'foreign') || {
              foreignProperty: [{ countryCode: 'ESP', adjustments: {} }],
            },
        });
        break;
      case 'other_income':
        // Tax liability adjustments path for other-income style EOY adjustments
        hmrcResult = await createTaxLiabilityAdjustment({
          ...o,
          body: req.body?.body || {
            adjustmentAmount: 1,
            typeOfAdjustment: req.body?.typeOfAdjustment || 'otherIncome',
          },
        });
        break;
      case 'losses':
        hmrcResult = await createBroughtForwardLoss({
          ...o,
          body: req.body?.body || {
            businessId: req.body?.businessIdSe,
            typeOfLoss: 'self-employment',
            lossAmount: 1,
            taxYearBroughtForwardFrom: taxYear,
          },
        });
        break;
      case 'calc':
        hmrcResult = await triggerCalculation({
          ...o,
          calculationType: 'in-year',
          body: {},
        });
        break;
      case 'calc_list':
        hmrcResult = await listCalculations(o);
        break;
      case 'bsas_trigger':
        hmrcResult = await triggerBsas({
          ...o,
          body: req.body?.body || {
            accountingPeriod: {
              startDate: `${taxYear.slice(0, 4)}-04-06`,
              endDate: `${Number(taxYear.slice(0, 4)) + 1}-04-05`,
            },
            typeOfBusiness: 'self-employment',
            businessId: req.body?.businessIdSe,
          },
        });
        break;
      case 'bsas_list':
        hmrcResult = await listBsas(o);
        break;
      case 'bsas_adjust': {
        const calculationId =
          req.body?.calculationId || req.body?.bsasCalculationId;
        if (!calculationId) {
          return res.status(400).json({
            error: 'calculationId required (from BSAS trigger/list)',
          });
        }
        hmrcResult = await submitBsasSeAdjustments({
          ...o,
          calculationId,
          body: req.body?.body || {
            income: { turnover: 1 },
            expenses: { consolidatedExpenses: 0 },
          },
        });
        break;
      }
      case 'final_calc':
        hmrcResult = await triggerCalculation({
          ...o,
          calculationType: 'intent-to-finalise',
          body: {},
        });
        break;
      case 'se_amend':
        if (!req.body?.businessIdSe || !req.body?.periodId) {
          return res
            .status(400)
            .json({ error: 'businessIdSe and periodId required' });
        }
        hmrcResult = await amendSePeriod({
          ...o,
          businessId: req.body.businessIdSe,
          periodId: req.body.periodId,
          body:
            req.body?.body ||
            periodBodyFromDraft(draftBody, 'self_employment') || {
              periodDates: {
                periodStartDate: String(req.body.periodId).split('_')[0],
                periodEndDate: String(req.body.periodId).split('_')[1],
              },
              periodIncome: { turnover: 1, other: 0 },
              periodExpenses: { consolidatedExpenses: 0 },
            },
        });
        break;
      case 'uk_amend':
        if (!req.body?.businessIdUk || !req.body?.periodId) {
          return res
            .status(400)
            .json({ error: 'businessIdUk and periodId required' });
        }
        hmrcResult = await amendUkPropertyPeriod({
          ...o,
          businessId: req.body.businessIdUk,
          periodId: req.body.periodId,
          taxYear:
            taxYear ||
            taxYearFromPeriodId(req.body.periodId) ||
            '2024-25',
          body:
            req.body?.body ||
            periodBodyFromDraft(draftBody, 'uk_property') || {
              fromDate: String(req.body.periodId).split('_')[0],
              toDate: String(req.body.periodId).split('_')[1],
              ukOtherProperty: {
                income: { periodAmount: 1 },
                expenses: { consolidatedExpenses: 0 },
              },
            },
        });
        break;
      case 'fp_amend':
        if (!req.body?.businessIdForeign || !req.body?.periodId) {
          return res
            .status(400)
            .json({ error: 'businessIdForeign and periodId required' });
        }
        hmrcResult = await amendForeignPropertyPeriod({
          ...o,
          businessId: req.body.businessIdForeign,
          periodId: req.body.periodId,
          taxYear:
            taxYear ||
            taxYearFromPeriodId(req.body.periodId) ||
            '2024-25',
          body:
            req.body?.body ||
            periodBodyFromDraft(draftBody, 'foreign_property') || {
              fromDate: String(req.body.periodId).split('_')[0],
              toDate: String(req.body.periodId).split('_')[1],
              foreignProperty: [
                {
                  countryCode: 'ESP',
                  income: {
                    rentIncome: { rentAmount: 1 },
                    foreignTaxCreditRelief: false,
                  },
                  expenses: { consolidatedExpenses: 0 },
                },
              ],
            },
        });
        break;
      case 'bsas_adjust_uk': {
        const calculationId =
          req.body?.calculationId || req.body?.bsasCalculationId;
        if (!calculationId) {
          return res.status(400).json({
            error: 'calculationId required (from BSAS trigger/list)',
          });
        }
        hmrcResult = await submitBsasUkAdjustments({
          ...o,
          calculationId,
          body: req.body?.body || {
            ukProperty: { income: { totalRentsReceived: 1 } },
          },
        });
        break;
      }
      case 'bsas_adjust_fp': {
        const calculationId =
          req.body?.calculationId || req.body?.bsasCalculationId;
        if (!calculationId) {
          return res.status(400).json({
            error: 'calculationId required (from BSAS trigger/list)',
          });
        }
        hmrcResult = await submitBsasForeignAdjustments({
          ...o,
          calculationId,
          body: req.body?.body || {
            foreignProperty: {
              income: { totalRentsReceived: 1 },
            },
          },
        });
        break;
      }
      case 'periods_of_account': {
        const businessId =
          req.body?.businessId ||
          req.body?.businessIdSe ||
          req.body?.businessIdUk ||
          req.body?.businessIdForeign;
        if (!businessId) {
          return res.status(400).json({ error: 'businessId required' });
        }
        hmrcResult = await retrievePeriodsOfAccount({
          ...o,
          businessId,
          taxYear,
        });
        break;
      }
      case 'periods_of_account_put': {
        const businessId =
          req.body?.businessId ||
          req.body?.businessIdSe ||
          req.body?.businessIdUk ||
          req.body?.businessIdForeign;
        if (!businessId) {
          return res.status(400).json({ error: 'businessId required' });
        }
        hmrcResult = await createOrUpdatePeriodsOfAccount({
          ...o,
          businessId,
          taxYear,
          body: req.body?.body || {
            periodsOfAccount: true,
            periodsOfAccountDates: [
              {
                startDate: `${taxYear.slice(0, 4)}-04-06`,
                endDate: `${Number(taxYear.slice(0, 4)) + 1}-04-05`,
              },
            ],
          },
        });
        break;
      }
      default:
        return res.status(400).json({
          error: 'Unknown workflow',
          known: KNOWN_WORKFLOWS,
        });
    }

    const summary = summariseHmrcResult(hmrcResult);
    /** @type {object} */
    let readback = { attempted: false };
    if (summary.ok) {
      readback = await performWorkflowReadback({
        workflow,
        hmrcResult,
        o,
        body: req.body || {},
        taxYear,
      });
    } else {
      readback = { attempted: false, note: 'skipped — primary HMRC call not 2xx' };
    }
    const receipt = recordWorkflowReceipt({
      userId: user.id,
      workflow,
      mode,
      ok: summary.ok,
      hmrcStatus: summary.hmrcStatus,
      hmrcCode: summary.hmrcCode,
      path: summary.path,
      request: { workflow, taxYear, nino: nino.slice(0, 2) + '****' },
      response: hmrcResult?.body ?? hmrcResult,
      readback,
    });
    writeAudit({
      userId: user.id,
      action: `workflow_${workflow}`,
      entityType: 'workflow',
      meta: {
        receiptId: receipt.receiptId,
        ok: summary.ok,
        hmrcStatus: summary.hmrcStatus,
        hmrcCode: summary.hmrcCode,
        readbackAttempted: Boolean(readback.attempted),
      },
    });
    res.status(summary.ok ? 200 : 502).json({
      ok: summary.ok,
      workflow,
      mode,
      previewOnly: false,
      receiptId: receipt.receiptId,
      hmrcStatus: summary.hmrcStatus,
      hmrcCode: summary.hmrcCode,
      path: summary.path,
      body: hmrcResult?.body,
      readback,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: e instanceof Error ? e.message : 'Workflow failed',
    });
  }
});

app.get('/api/receipts/:attemptId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const row = getDb()
    .prepare(`SELECT * FROM submission_attempts WHERE id = ?`)
    .get(req.params.attemptId);
  if (!row) return res.status(404).json({ error: 'Receipt not found' });
  if (row.user_id && row.user_id !== user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  let evidence = null;
  try {
    evidence = row.evidence_json ? JSON.parse(row.evidence_json) : null;
  } catch {
    evidence = null;
  }
  const receipt = {
    id: row.id,
    draftId: row.draft_id,
    mode: row.mode,
    ok: Boolean(row.ok),
    status: row.status || null,
    correlationId: row.correlation_id || evidence?.correlationId || null,
    supersedesAttemptId: row.supersedes_attempt_id || null,
    createdAt: row.created_at,
    results: JSON.parse(row.results_json),
    evidence,
  };
  if (req.query.download === '1' || req.query.download === 'true') {
    const body = JSON.stringify({ ok: true, receipt }, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="receipt-${row.id.slice(0, 8)}.json"`
    );
    return res.status(200).send(body);
  }
  res.json({ ok: true, receipt });
});

/** Full integrity evidence pack for a submission attempt */
app.get('/api/receipts/:attemptId/evidence', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const pack = getSubmissionEvidence(req.params.attemptId, user.id);
  if (!pack) {
    // Fallback: allow owner check via raw row
    const row = getDb()
      .prepare(`SELECT * FROM submission_attempts WHERE id = ?`)
      .get(req.params.attemptId);
    if (!row) return res.status(404).json({ error: 'Evidence not found' });
    if (row.user_id && row.user_id !== user.id) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    return res.status(404).json({ error: 'Evidence pack not stored for this attempt' });
  }
  if (req.query.download === '1' || req.query.download === 'true') {
    const body = JSON.stringify({ ok: true, evidence: pack }, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="evidence-${pack.id.slice(0, 8)}.json"`
    );
    return res.status(200).send(body);
  }
  res.json({ ok: true, evidence: pack });
});

/** Operator-set HMRC service status for deadline messaging */
app.get('/api/hmrc/service-status', (_req, res) => {
  const row = getDb()
    .prepare(
      `SELECT status, message, updated_at FROM hmrc_service_status WHERE id = 'current'`
    )
    .get();
  res.json({
    ok: true,
    status: row?.status || 'unknown',
    message:
      row?.message ||
      'No operator status set — check GOV.UK HMRC service status for live incidents.',
    updatedAt: row?.updated_at || null,
    govUk:
      'https://www.gov.uk/government/collections/hmrc-service-availability-and-issues',
  });
});

app.put('/api/admin/hmrc-service-status', (req, res) => {
  const secret = process.env.ADMIN_JOB_SECRET || process.env.JOB_SECRET;
  if (!secret || req.get('x-job-secret') !== secret) {
    return res.status(401).json({ error: 'Admin secret required' });
  }
  const status = String(req.body?.status || 'unknown').slice(0, 40);
  const message = String(req.body?.message || '').slice(0, 500);
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO hmrc_service_status (id, status, message, updated_at)
       VALUES ('current', ?, ?, ?)`
    )
    .run(status, message, now);
  res.json({ ok: true, status, message, updatedAt: now });
});

app.get('/api/me/submissions', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const rows = getDb()
    .prepare(
      `SELECT id, draft_id, mode, ok, created_at FROM submission_attempts
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(user.id);
  res.json({
    ok: true,
    submissions: rows.map((r) => ({
      id: r.id,
      draftId: r.draft_id,
      mode: r.mode,
      ok: Boolean(r.ok),
      createdAt: r.created_at,
    })),
  });
});

app.get('/api/me/submissions/export', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const csv = exportSubmissionsCsv(user.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="submissions-export.csv"'
  );
  res.status(200).send(csv);
});

app.get('/api/me/clients/export', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : '';
  if (!firmId || !userCanAccessFirm(user.id, firmId)) {
    return res.status(403).json({ error: 'Not allowed for this firm.' });
  }
  const csv = exportClientsCsv(firmId);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="clients-export.csv"'
  );
  res.status(200).send(csv);
});

app.patch('/api/me/clients/:clientId', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = updateClientDetails({
    clientId: req.params.clientId,
    userId: user.id,
    dueDate: req.body?.dueDate,
    displayName: req.body?.name,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: result.client.firmId,
    userId: user.id,
    action: 'client_updated',
    entityType: 'client',
    entityId: result.client.id,
  });
  res.json({ ok: true, client: result.client });
});

app.post('/api/me/clients/:clientId/portal-invite', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const result = createPortalInvite({
    clientId: req.params.clientId,
    userId: user.id,
  });
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  writeAudit({
    firmId: result.client.firmId,
    userId: user.id,
    action: 'portal_invite_created',
    entityType: 'client',
    entityId: result.client.id,
  });
  res.json({
    ok: true,
    token: result.token,
    path: result.path,
    url: `${req.protocol}://${req.get('host')}${result.path}`,
  });
});

app.get('/api/portal/client', (req, res) => {
  const token = String(req.query.token || '');
  const client = getClientByPortalToken(token);
  if (!client) {
    return res.status(404).json({ error: 'Invalid or expired portal link.' });
  }
  res.json({
    ok: true,
    client: {
      name: client.name,
      status: client.status,
      statusLabel: client.statusLabel,
      dueDate: client.dueDate,
      firmName: client.firmName,
      portalAccess: true,
    },
  });
});

app.get('/api/status', (_req, res) => {
  const client = createSubmitClient();
  const oauth = oauthConfig();
  res.json({
    ok: true,
    appVersion: APP_VERSION,
    ...hmrcRecognitionPublic(),
    hmrcMode: client.mode,
    liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
    previewOnly: client.mode === 'double',
    oauthMock: oauth.mock,
    product: 'HMRC MTD ITSA bridging-only',
    supported: ['self_employment', 'uk_property', 'foreign_property'],
    // Accurate privacy: files are uploaded for mapping; ongoing books stay in the user's spreadsheet.
    recordsStayInSpreadsheet: true,
    fileUploadedForMapping: true,
    notAFullLedger: true,
    practiceWritesEnabled: process.env.DEMO_PRACTICE_WRITES === '1',
    authEnabled: true,
    serverOwnedDrafts: true,
    gate: '0-safe-demo',
    pilotFeatures: ['auth', 'drafts', 'workspace'],
    honesty: {
      publicSubmitIsPreview: client.mode === 'double',
      hmrcRecognisedSoftware: false,
      realHmrcRequires:
        'HMRC Developer Hub app + OAuth credentials + HMRC_ALLOW_LIVE_SUBMIT=1 + non-mock token',
      demoPracticeStore: true,
      realAuthenticatedWorkspace: true,
      billingCharged: false,
      paymentsLive: paymentsLive(),
      emailDelivered: emailDeliveryMode() !== 'stub',
      csrfEnforced: csrfEnforced(),
      loginLockout: loginLockoutConfig(),
      productFreeze: true,
    },
    productSurfaces: productSurfacePublicStatus(),
    audiences: [
      'self_employed',
      'landlords',
      'bookkeepers',
      'accountants',
      'practices',
      'clients',
    ],
  });
});

/** Machine-readable honesty map for HMRC / security review */
app.get('/api/integrity', (_req, res) => {
  const oauth = oauthConfig();
  const live = process.env.HMRC_ALLOW_LIVE_SUBMIT === '1';
  res.json({
    ok: true,
    product: 'Spreadsheet Tax',
    intellectualProperty: 'Lee Hine',
    version: APP_VERSION,
    appVersion: APP_VERSION,
    ...hmrcRecognitionPublic(),
    display: {
      banner: HMRC_RECOGNITION_BANNER,
      siteChrome: '/js/site-chrome.js',
    },
    productType: 'full MTD bridging (in-year + EOY/BSAS + extras) — sandbox operational build',
    productionSwitch:
      'Set HMRC_OAUTH_ENV=production and Production client id/secret only after HMRC grants Production APIs. Same code path; host from env.',
    mtd: mtdCapabilityMatrix(),
    layers: {
      spreadsheetImportMapping: {
        real: true,
        notes: 'CSV/XLSX parse → map → payloads → validation; server-owned drafts',
      },
      submitPreviewDouble: {
        real: true,
        isHmrcFiling: false,
        notes: 'Default public submit path; builds same request shape, no external HMRC call',
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
        notes: 'User-restricted sandbox period create; property bodies strip preview-only keys',
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
        notes: 'User-restricted income & expenditure obligations via Obligations (MTD) 3.0',
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
  });
});

/** Practice / accountant / client portal APIs (demo store) */
app.get('/api/firms', (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    fictional: true,
    notice:
      'Demonstration portfolio only — not real client data. Use /workspace for authenticated firm books.',
    firms: listFirms(),
  });
});

app.get('/api/accountants', (req, res) => {
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : null;
  res.json({
    ok: true,
    demo: true,
    fictional: true,
    accountants: listAccountants(firmId),
  });
});

app.get('/api/clients', (req, res) => {
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : null;
  const accountantId =
    typeof req.query.accountantId === 'string' ? req.query.accountantId : null;
  res.json({
    ok: true,
    demo: true,
    fictional: true,
    notice:
      'Demonstration portfolio only. Authenticated firm books are at /api/me/clients.',
    clients: listClientsForFirm({ firmId, accountantId }),
  });
});

app.get('/api/clients/:clientId', (req, res) => {
  const client = getClient(req.params.clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({
    ok: true,
    demo: true,
    fictional: true,
    client,
    transitions: allowedClientTransitions(client.id),
  });
});

app.get('/api/workflow-statuses', (_req, res) => {
  res.json({ ok: true, demo: true, statuses: listWorkflowStatuses() });
});

/**
 * Gate 0 practice freeze: no unauthenticated professional writes unless
 * DEMO_PRACTICE_WRITES=1 (local demo only). Read APIs remain available.
 */
app.patch('/api/clients/:clientId/workflow', (req, res) => {
  if (process.env.DEMO_PRACTICE_WRITES !== '1') {
    return res.status(403).json({
      error:
        'Practice workflow changes are frozen until authentication and tenancy are in place. Set DEMO_PRACTICE_WRITES=1 only for local demo.',
      frozen: true,
    });
  }
  const result = updateClientWorkflow(req.params.clientId, {
    status: typeof req.body?.status === 'string' ? req.body.status : null,
    accountantId:
      typeof req.body?.accountantId === 'string' ? req.body.accountantId : null,
    note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : null,
    actor:
      typeof req.body?.actor === 'string'
        ? req.body.actor.slice(0, 100)
        : 'Practice user',
  });
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  return res.json({ ok: true, ...result });
});

if (!fs.existsSync(templatePath)) {
  console.warn('Warning: template CSV missing at', templatePath);
}

const port = Number(process.env.PORT) || 3000;

// Allow importing app without listening (tests)
if (process.env.SPREADSHEET_TAX_NO_LISTEN !== '1') {
  try {
    assertProductionBoot(process.env);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  // Warm operational Postgres schema when DATABASE_URL is present
  ensureOperationalPostgres().catch((e) =>
    console.warn('[boot] operational postgres:', e?.message || e)
  );
  app.listen(port, '0.0.0.0', () => {
    console.log(`Spreadsheet Tax listening on http://0.0.0.0:${port}`);
    console.log(`  Sales:      http://localhost:${port}/`);
    console.log(`  App:        http://localhost:${port}/app`);
    console.log(`  Accountant: http://localhost:${port}/accountant`);
    console.log(`  Practice:   http://localhost:${port}/practice`);
    console.log(`  Portal:     http://localhost:${port}/portal`);
    console.log(`  Template:   http://localhost:${port}/download/template`);
    console.log(
      `  Store:      ${isPostgresMode() ? 'postgres (dual-write)' : 'sqlite'}`
    );
  });
}

export default app;
