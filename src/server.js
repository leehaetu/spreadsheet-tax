/**
 * Spreadsheet Tax — sales site, bridging app, practice portals, client portal.
 * Intellectual property: Lee Hine (see LICENSE).
 */

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { processLocalFile } from './lib/pipeline.js';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');
const testSpreadsheetsDir = path.join(root, 'test-spreadsheets');

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
  res.setHeader('X-App-Version', '1.8.0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  );
  next();
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
  const ready = dbOk;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'spreadsheet-tax',
    version: '1.10.0',
    bridging: true,
    db: dbOk,
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
    res.status(200).json({ ready: true, version: '1.10.0' });
  } catch {
    res.status(503).json({ ready: false });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'sales.html'));
});

app.get('/app', (_req, res) => {
  res.sendFile(path.join(publicDir, 'app.html'));
});

app.get('/self-employed', (_req, res) => {
  res.sendFile(path.join(publicDir, 'self-employed.html'));
});

app.get('/landlords', (_req, res) => {
  res.sendFile(path.join(publicDir, 'landlords.html'));
});

app.get('/professionals', (_req, res) => {
  res.sendFile(path.join(publicDir, 'professionals.html'));
});

app.get('/firms', (_req, res) => {
  res.sendFile(path.join(publicDir, 'firms.html'));
});

app.get('/accountant', (_req, res) => {
  res.sendFile(path.join(publicDir, 'accountant.html'));
});

app.get('/practice', (_req, res) => {
  res.sendFile(path.join(publicDir, 'practice.html'));
});

app.get('/portal', (_req, res) => {
  res.sendFile(path.join(publicDir, 'portal.html'));
});

app.get('/license', (_req, res) => {
  res.sendFile(path.join(publicDir, 'license.html'));
});

app.get('/legal', (_req, res) => {
  res.sendFile(path.join(publicDir, 'legal.html'));
});

app.get('/pricing', (_req, res) => {
  res.sendFile(path.join(publicDir, 'pricing.html'));
});

app.get('/how-it-works', (_req, res) => {
  res.sendFile(path.join(publicDir, 'how-it-works.html'));
});

app.get('/security', (_req, res) => {
  res.sendFile(path.join(publicDir, 'security.html'));
});
app.get('/integrity', (_req, res) => {
  res.sendFile(path.join(publicDir, 'integrity.html'));
});
app.get('/privacy', (_req, res) => {
  res.sendFile(path.join(publicDir, 'privacy.html'));
});
app.get('/terms', (_req, res) => {
  res.sendFile(path.join(publicDir, 'terms.html'));
});

app.get('/help', (_req, res) => {
  res.sendFile(path.join(publicDir, 'help.html'));
});

app.get('/templates', (_req, res) => {
  res.sendFile(path.join(publicDir, 'templates.html'));
});

app.get('/signin', (_req, res) => {
  res.sendFile(path.join(publicDir, 'signin.html'));
});

app.get('/register', (_req, res) => {
  res.sendFile(path.join(publicDir, 'register.html'));
});

app.get('/workspace', (_req, res) => {
  res.sendFile(path.join(publicDir, 'workspace.html'));
});

app.get('/connect-hmrc', (_req, res) => {
  res.sendFile(path.join(publicDir, 'connect-hmrc.html'));
});

app.get('/billing', (_req, res) => {
  res.sendFile(path.join(publicDir, 'billing.html'));
});

app.get('/account', (_req, res) => {
  res.sendFile(path.join(publicDir, 'account.html'));
});

app.get('/history', (_req, res) => {
  res.sendFile(path.join(publicDir, 'history.html'));
});

app.get('/forgot-password', (_req, res) => {
  res.sendFile(path.join(publicDir, 'forgot-password.html'));
});

app.get('/reset-password', (_req, res) => {
  res.sendFile(path.join(publicDir, 'reset-password.html'));
});

app.get('/accept-invite', (_req, res) => {
  res.sendFile(path.join(publicDir, 'accept-invite.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
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
      meta: { filename },
    });
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
    // payloads still returned for UI preview; submit prefers draftId
    payloads,
  });
}

/**
 * Upload local spreadsheet → parse → map → quarterly payloads (preview).
 */
app.post('/api/import', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'No file uploaded. Use form field "file".' });
      }
      const result = processLocalFile(req.file.buffer, req.file.originalname);
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
  if (!allowLive) {
    return createHmrcClient({
      mode: 'double',
      accessToken: undefined,
      clientId: undefined,
      clientSecret: undefined,
      req: opts.req || null,
      userId: opts.userId || null,
    });
  }
  if (opts.accessToken) {
    return createHmrcClient({
      mode: opts.mode === 'production' ? 'sandbox' : opts.mode || 'sandbox',
      accessToken: opts.accessToken,
      req: opts.req || null,
      userId: opts.userId || null,
    });
  }
  return createHmrcClient({
    req: opts.req || null,
    userId: opts.userId || null,
  });
}

/** Simple in-process rate limit (per key). */
function rateLimit(key, max, windowMs) {
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
    if (!rateLimit(`submit:${ip}`, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many submit attempts. Try again shortly.' });
    }

    if (idempotencyKey) {
      const prior = getIdempotentResponse(String(idempotencyKey));
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
      draft = getDraft(String(draftId));
      if (!draft) {
        return res
          .status(404)
          .json({ error: 'Draft not found. Import the file again.' });
      }
      payloads = draft.payloads;
    } else if (
      clientPayloads &&
      (process.env.ALLOW_CLIENT_PAYLOAD_SUBMIT === '1' ||
        process.env.NODE_ENV !== 'production')
    ) {
      // Dev/test fallback only — production requires draftId
      payloads = clientPayloads;
    }

    if (!payloads) {
      return res.status(400).json({
        error:
          'Missing draftId from import. Import a spreadsheet first so the server owns the figures.',
      });
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

    const user = getSessionUser(getSessionIdFromRequest(req));
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
        tokenMode = conn.mode;
        connectionMock = false;
      }
    }

    const client = createSubmitClient({
      accessToken,
      mode: tokenMode,
      req,
      userId: user?.id || null,
    });
    if (client.mode !== 'double' && process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1') {
      console.warn(
        '[security] blocked non-double submit without HMRC_ALLOW_LIVE_SUBMIT'
      );
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
    const externalCallMade = results.some((r) => r.externalCallMade === true);
    let attemptId = null;
    if (draft) {
      if (ok) markDraftSubmitted(draft.id);
      attemptId = recordSubmissionAttempt({
        draftId: draft.id,
        userId: user?.id,
        mode: client.mode,
        ok,
        results,
        idempotencyKey: idempotencyKey
          ? String(idempotencyKey)
          : null,
      });
      writeAudit({
        userId: user?.id || null,
        action: ok ? 'submit_ok' : 'submit_failed',
        entityType: 'draft',
        entityId: draft.id,
        meta: {
          mode: client.mode,
          attemptId,
          externalCallMade,
          previewOnly: client.mode === 'double',
        },
      });
    }

    res.json({
      ok,
      mode: client.mode,
      draftId: draft?.id || null,
      attemptId,
      liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
      previewOnly: client.mode === 'double',
      externalCallMade,
      // Headers are prepared on the request descriptor; only "sent" on external calls
      fraudHeadersPrepared: true,
      fraudHeadersSentToHmrc: externalCallMade,
      connectionMock,
      results,
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
app.post('/api/auth/register', (req, res) => {
  try {
    if (!rateLimit(`register:${clientIp(req)}`, 10, 60_000)) {
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

app.post('/api/auth/login', (req, res) => {
  try {
    if (!rateLimit(`login:${clientIp(req)}`, 20, 60_000)) {
      return res
        .status(429)
        .json({ error: 'Too many login attempts. Try again shortly.' });
    }
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    const row = findUserByEmail(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const session = createSession(row.id);
    res.setHeader(
      'Set-Cookie',
      sessionCookieHeader(session.id, session.expiresAt)
    );
    writeAudit({
      userId: row.id,
      action: 'user_login',
      entityType: 'user',
      entityId: row.id,
    });
    res.json({
      ok: true,
      user: { id: row.id, email: row.email, name: row.name },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Sign-in failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sid = getSessionIdFromRequest(req);
  destroySession(sid);
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
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
  if (!rateLimit(`forgot:${clientIp(req)}`, 8, 60_000)) {
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

/** HMRC OAuth */
app.get('/api/hmrc/connect', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const result = buildAuthorizeUrl({ userId: user.id });
    res.json({ ok: true, ...result, config: { mock: oauthConfig().mock } });
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
      meta: { mode: conn.mode, mock: conn.mock },
    });
    res.redirect('/connect-hmrc?connected=1');
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

/** Billing / plans (stub — no card processing) */
app.get('/api/plans', (_req, res) => {
  res.json({ ok: true, plans: listPublicPlans() });
});

app.post('/api/billing/select-plan', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const planId = String(req.body?.planId || 'free');
    const plan = setUserPlan(user.id, planId);
    writeAudit({
      userId: user.id,
      action: 'plan_selected',
      entityType: 'subscription',
      meta: { planId },
    });
    res.json({
      ok: true,
      plan,
      note: 'Experimental packaging only — no card charge in this build.',
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

/** Signed-in practice can trigger deadline reminders for their firm book */
app.post('/api/me/jobs/deadline-reminders', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const memberships = listMemberships(user.id);
  if (!memberships.length) {
    return res.status(403).json({ error: 'No firm membership.' });
  }
  const result = await runDeadlineReminders(
    Number(req.body?.withinDays) || 14
  );
  writeAudit({
    userId: user.id,
    action: 'deadline_reminders_run',
    meta: { count: result.count, deliveredCount: result.deliveredCount },
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
  const draft = getDraft(req.params.draftId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  const user = getSessionUser(getSessionIdFromRequest(req));
  if (draft.userId && (!user || user.id !== draft.userId)) {
    return res.status(403).json({ error: 'Not allowed to view this draft.' });
  }
  res.json({ ok: true, draft });
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
  res.status(201).json({ ok: true, client: getClientRow(id) });
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
  const receipt = {
    id: row.id,
    draftId: row.draft_id,
    mode: row.mode,
    ok: Boolean(row.ok),
    createdAt: row.created_at,
    results: JSON.parse(row.results_json),
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
      realHmrcRequires:
        'HMRC Developer Hub app + OAuth credentials + HMRC_ALLOW_LIVE_SUBMIT=1 + non-mock token',
      demoPracticeStore: true,
      realAuthenticatedWorkspace: true,
      billingCharged: false,
      emailDelivered: false,
    },
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
    version: '1.10.0',
    productType: 'in-year bridging (quarterly updates)',
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
        inSoftware: false,
        signpostToHmrc: true,
        notes:
          'Does not call Individual Calculations; customers are signposted to their HMRC online account for estimates',
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
      billing: { cardPayments: false, planSelectionStored: true },
      email: {
        delivered: emailDeliveryMode() !== 'stub',
        provider: emailDeliveryMode(),
        note: 'Set EMAIL_WEBHOOK_URL to deliver; default is stub log only',
      },
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
  app.listen(port, '0.0.0.0', () => {
    console.log(`Spreadsheet Tax listening on http://0.0.0.0:${port}`);
    console.log(`  Sales:      http://localhost:${port}/`);
    console.log(`  App:        http://localhost:${port}/app`);
    console.log(`  Accountant: http://localhost:${port}/accountant`);
    console.log(`  Practice:   http://localhost:${port}/practice`);
    console.log(`  Portal:     http://localhost:${port}/portal`);
    console.log(`  Template:   http://localhost:${port}/download/template`);
  });
}

export default app;
