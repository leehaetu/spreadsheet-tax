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
} from './lib/auth.js';
import {
  createDraft,
  getDraft,
  listDraftsForUser,
  markDraftSubmitted,
  recordSubmissionAttempt,
  writeAudit,
} from './lib/drafts.js';
import {
  listFirmsForUser,
  listClients as listDbClients,
  getClientRow,
  allowedTransitions as dbAllowedTransitions,
  updateClientStatus,
  listWorkflowStatusCatalog,
} from './lib/practice-db.js';
import { getDb } from './lib/db.js';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getActiveConnection,
  revokeConnection,
  oauthConfig,
} from './lib/hmrc-oauth.js';
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
  try {
    getDb().prepare('SELECT 1 AS x').get();
    dbOk = true;
  } catch {
    dbOk = false;
  }
  res.json({
    ok: true,
    service: 'spreadsheet-tax',
    bridging: true,
    db: dbOk,
    oauthMock: oauthConfig().mock,
    liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
    portals: ['accountant', 'practice', 'client', 'workspace'],
  });
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
    });
  }
  if (opts.accessToken) {
    return createHmrcClient({
      mode: opts.mode === 'production' ? 'sandbox' : opts.mode || 'sandbox',
      accessToken: opts.accessToken,
      req: opts.req || null,
    });
  }
  return createHmrcClient({ req: opts.req || null });
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
    } = req.body || {};

    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]
        : req.socket.remoteAddress) || 'unknown';
    if (!rateLimit(`submit:${ip}`, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many submit attempts. Try again shortly.' });
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
      process.env.ALLOW_CLIENT_PAYLOAD_SUBMIT === '1'
    ) {
      payloads = clientPayloads;
    } else if (clientPayloads) {
      // Free-check fallback when draft persist failed
      payloads = clientPayloads;
    }

    if (!payloads) {
      return res.status(400).json({
        error: 'Missing draftId from import. Import a spreadsheet first.',
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
    if (user && process.env.HMRC_ALLOW_LIVE_SUBMIT === '1') {
      const conn = getActiveConnection(user.id);
      if (conn && !conn.expired && conn.accessToken) {
        accessToken = conn.accessToken;
        tokenMode = conn.mode;
      }
    }

    const client = createSubmitClient({
      accessToken,
      mode: tokenMode,
      req,
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
      businessIdSe,
      businessIdUk,
      businessIdForeign,
      taxYear: validation.normalized.taxYear,
    });

    const ok = results.every((r) => r.ok);
    if (draft) {
      if (ok) markDraftSubmitted(draft.id);
      recordSubmissionAttempt({
        draftId: draft.id,
        userId: user?.id,
        mode: client.mode,
        ok,
        results,
      });
      writeAudit({
        userId: user?.id || null,
        action: ok ? 'submit_ok' : 'submit_failed',
        entityType: 'draft',
        entityId: draft.id,
        meta: { mode: client.mode },
      });
    }

    res.json({
      ok,
      mode: client.mode,
      draftId: draft?.id || null,
      liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
      fraudHeadersAttached: true,
      results,
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Submit failed' });
  }
});

/** Auth */
app.post('/api/auth/register', (req, res) => {
  try {
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
          connected: !hmrc.expired,
          expired: Boolean(hmrc.expired),
          mode: hmrc.mode,
          expiresAt: hmrc.expiresAt,
        }
      : { connected: false },
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
  res.json({
    ok: true,
    oauth: oauthConfig(),
    connection: hmrc
      ? {
          connected: !hmrc.expired,
          expired: Boolean(hmrc.expired),
          mode: hmrc.mode,
          expiresAt: hmrc.expiresAt,
        }
      : null,
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
    res.json({
      ok: true,
      users: Number(users),
      drafts: Number(drafts),
      submissionAttempts: Number(submits),
    });
  } catch {
    res.json({ ok: true, users: 0, drafts: 0, submissionAttempts: 0 });
  }
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

/** Authenticated practice (persistent) */
app.get('/api/me/firms', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json({ ok: true, firms: listFirmsForUser(user.id) });
});

app.get('/api/me/clients', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const firmId =
    typeof req.query.firmId === 'string' ? req.query.firmId : null;
  if (!firmId || !userCanAccessFirm(user.id, firmId)) {
    return res.status(400).json({ error: 'Valid firmId required for your membership.' });
  }
  res.json({ ok: true, clients: listDbClients(firmId) });
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

app.get('/api/status', (_req, res) => {
  const client = createSubmitClient();
  res.json({
    ok: true,
    hmrcMode: client.mode,
    liveSubmitEnabled: process.env.HMRC_ALLOW_LIVE_SUBMIT === '1',
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

/** Practice / accountant / client portal APIs (demo store) */
app.get('/api/firms', (_req, res) => {
  res.json({ ok: true, firms: listFirms() });
});

app.get('/api/accountants', (req, res) => {
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : null;
  res.json({ ok: true, accountants: listAccountants(firmId) });
});

app.get('/api/clients', (req, res) => {
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : null;
  const accountantId =
    typeof req.query.accountantId === 'string' ? req.query.accountantId : null;
  res.json({
    ok: true,
    clients: listClientsForFirm({ firmId, accountantId }),
  });
});

app.get('/api/clients/:clientId', (req, res) => {
  const client = getClient(req.params.clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({ ok: true, client, transitions: allowedClientTransitions(client.id) });
});

app.get('/api/workflow-statuses', (_req, res) => {
  res.json({ ok: true, statuses: listWorkflowStatuses() });
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
