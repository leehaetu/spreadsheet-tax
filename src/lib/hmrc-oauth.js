/**
 * HMRC OAuth 2.0 authorize + token exchange (sandbox/production bases).
 * Without client credentials, returns mock connect for local pilot demos.
 */

import crypto from 'node:crypto';
import { getDb } from './db.js';
import { newId } from './auth.js';
import { encryptSecret, decryptSecret } from './crypto-secret.js';

const SANDBOX_AUTH = 'https://test-api.service.hmrc.gov.uk/oauth/authorize';
const SANDBOX_TOKEN = 'https://test-api.service.hmrc.gov.uk/oauth/token';
const LIVE_AUTH = 'https://api.service.hmrc.gov.uk/oauth/authorize';
const LIVE_TOKEN = 'https://api.service.hmrc.gov.uk/oauth/token';

const DEFAULT_SCOPES = [
  'write:self-assessment',
  'read:self-assessment',
].join(' ');

/**
 * @returns {{ mode: string, clientId: string|null, clientSecret: string|null, redirectUri: string, mock: boolean }}
 */
export function oauthConfig() {
  const mode =
    process.env.HMRC_OAUTH_ENV === 'production' ? 'production' : 'sandbox';
  const clientId = process.env.HMRC_CLIENT_ID || null;
  const clientSecret = process.env.HMRC_CLIENT_SECRET || null;
  const redirectUri =
    process.env.HMRC_REDIRECT_URI ||
    `http://localhost:${process.env.PORT || 3000}/api/hmrc/callback`;
  const mock = !clientId || !clientSecret || process.env.HMRC_OAUTH_MOCK === '1';
  return { mode, clientId, clientSecret, redirectUri, mock };
}

/**
 * Ensure oauth_states can carry authority_type (individual vs agent).
 */
export function ensureOauthStateSchema() {
  const database = getDb();
  const cols = database
    .prepare(`PRAGMA table_info(oauth_states)`)
    .all()
    .map((c) => c.name);
  if (!cols.includes('authority_type')) {
    database.exec(
      `ALTER TABLE oauth_states ADD COLUMN authority_type TEXT NOT NULL DEFAULT 'individual'`
    );
  }
}

/**
 * @param {string} raw
 * @returns {'individual'|'agent'}
 */
export function normalizeAuthorityType(raw) {
  const t = String(raw || 'individual').toLowerCase().trim();
  if (t === 'agent' || t === 'organisation' || t === 'agent_services') {
    return 'agent';
  }
  return 'individual';
}

/**
 * @param {{ userId: string, state?: string, authorityType?: string }} opts
 */
export function buildAuthorizeUrl(opts) {
  ensureOauthStateSchema();
  const cfg = oauthConfig();
  const authorityType = normalizeAuthorityType(opts.authorityType);
  const state = opts.state || crypto.randomBytes(16).toString('hex');
  // store state + intended authority (individual taxpayer vs agent)
  getDb()
    .prepare(
      `INSERT INTO oauth_states (id, user_id, created_at, authority_type) VALUES (?, ?, ?, ?)`
    )
    .run(state, opts.userId, new Date().toISOString(), authorityType);

  if (cfg.mock) {
    return {
      mock: true,
      state,
      authorityType,
      url: `/api/hmrc/callback?code=mock-auth-code&state=${encodeURIComponent(state)}`,
    };
  }

  const authBase = cfg.mode === 'production' ? LIVE_AUTH : SANDBOX_AUTH;
  // Agent and individual use separate HMRC Hub apps in production; scopes may differ.
  const scopes =
    authorityType === 'agent'
      ? process.env.HMRC_OAUTH_SCOPES_AGENT ||
        process.env.HMRC_OAUTH_SCOPES ||
        DEFAULT_SCOPES
      : process.env.HMRC_OAUTH_SCOPES || DEFAULT_SCOPES;
  const clientId =
    authorityType === 'agent' && process.env.HMRC_AGENT_CLIENT_ID
      ? process.env.HMRC_AGENT_CLIENT_ID
      : cfg.clientId;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    state,
    redirect_uri: cfg.redirectUri,
  });
  return {
    mock: false,
    state,
    authorityType,
    url: `${authBase}?${params.toString()}`,
    note:
      authorityType === 'agent'
        ? 'Agent OAuth journey — use agent Hub credentials when configured (HMRC_AGENT_CLIENT_ID).'
        : 'Individual taxpayer OAuth journey.',
  };
}

/**
 * Application-restricted token (client credentials) for Hello World /app tests.
 * Not used for user tax data — only connectivity checks.
 * @returns {Promise<{ ok: boolean, accessToken?: string, error?: string, mode?: string }>}
 */
export async function getApplicationAccessToken() {
  const cfg = oauthConfig();
  if (cfg.mock || !cfg.clientId || !cfg.clientSecret) {
    return {
      ok: false,
      error:
        'HMRC client credentials missing or OAuth mock enabled (set HMRC_CLIENT_ID/SECRET and HMRC_OAUTH_MOCK=0).',
    };
  }
  const tokenUrl = cfg.mode === 'production' ? LIVE_TOKEN : SANDBOX_TOKEN;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error:
        json.error_description ||
        json.error ||
        `Token endpoint returned ${res.status}`,
      mode: cfg.mode,
    };
  }
  return {
    ok: true,
    accessToken: json.access_token,
    mode: cfg.mode,
    expiresIn: json.expires_in,
  };
}

/**
 * Call HMRC Hello World application endpoint to prove Hub credentials work.
 * @returns {Promise<object>}
 */
export async function pingHmrcHelloApplication() {
  const cfg = oauthConfig();
  const base =
    cfg.mode === 'production'
      ? 'https://api.service.hmrc.gov.uk'
      : 'https://test-api.service.hmrc.gov.uk';
  const openRes = await fetch(`${base}/hello/world`, {
    headers: { Accept: 'application/vnd.hmrc.1.0+json' },
  });
  const openBody = await openRes.text();
  const appTok = await getApplicationAccessToken();
  let application = { skipped: true };
  if (appTok.ok) {
    const appRes = await fetch(`${base}/hello/application`, {
      headers: {
        Accept: 'application/vnd.hmrc.1.0+json',
        Authorization: `Bearer ${appTok.accessToken}`,
      },
    });
    const appText = await appRes.text();
    application = {
      status: appRes.status,
      ok: appRes.ok,
      body: appText.slice(0, 500),
    };
  } else {
    application = { ok: false, error: appTok.error };
  }
  return {
    environment: cfg.mode,
    mock: cfg.mock,
    hasClientId: Boolean(cfg.clientId),
    hasClientSecret: Boolean(cfg.clientSecret),
    redirectUri: cfg.redirectUri,
    openAccess: {
      status: openRes.status,
      ok: openRes.ok,
      body: openBody.slice(0, 500),
    },
    application,
    subscriptionsExpected: [
      'Self Employment Business (MTD) 5.0',
      'Property Business (MTD) 6.0',
      'Business Details (MTD) 2.0',
      'Obligations (MTD) 3.0',
      'Test Fraud Prevention Headers 1.0',
      'Self Assessment Test Support (MTD) 1.0',
      'Create Test User 1.0',
      'Hello World 1.0',
      'Business Source Adjustable Summary (MTD) 7.0 — later',
      'Business Income Source Summary (MTD) 3.0 — later',
      'Individual Calculations (MTD) 8.0 — later',
    ],
  };
}

/**
 * @param {{ code: string, state: string }} opts
 */
export async function exchangeCodeForTokens(opts) {
  ensureOauthStateSchema();
  const cfg = oauthConfig();
  const row = getDb()
    .prepare(`SELECT * FROM oauth_states WHERE id = ?`)
    .get(opts.state);
  if (!row) {
    throw new Error('Invalid or expired OAuth state.');
  }
  getDb().prepare(`DELETE FROM oauth_states WHERE id = ?`).run(opts.state);
  const authorityType = normalizeAuthorityType(row.authority_type);

  if (cfg.mock || opts.code === 'mock-auth-code') {
    const access = `mock-access-${crypto.randomBytes(8).toString('hex')}`;
    const refresh = `mock-refresh-${crypto.randomBytes(8).toString('hex')}`;
    return saveConnection({
      userId: row.user_id,
      mode: 'sandbox',
      authorityType,
      accessToken: access,
      refreshToken: refresh,
      scopes: DEFAULT_SCOPES,
      expiresInSec: 14400,
    });
  }

  const tokenUrl = cfg.mode === 'production' ? LIVE_TOKEN : SANDBOX_TOKEN;
  const clientId =
    authorityType === 'agent' && process.env.HMRC_AGENT_CLIENT_ID
      ? process.env.HMRC_AGENT_CLIENT_ID
      : cfg.clientId;
  const clientSecret =
    authorityType === 'agent' && process.env.HMRC_AGENT_CLIENT_SECRET
      ? process.env.HMRC_AGENT_CLIENT_SECRET
      : cfg.clientSecret;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json.error_description || json.error || 'HMRC token exchange failed'
    );
  }
  return saveConnection({
    userId: row.user_id,
    mode: cfg.mode === 'production' ? 'production' : 'sandbox',
    authorityType,
    accessToken: json.access_token,
    refreshToken: json.refresh_token || null,
    scopes: json.scope || DEFAULT_SCOPES,
    expiresInSec: Number(json.expires_in) || 14400,
  });
}

/**
 * @param {object} p
 */
export function saveConnection(p) {
  const database = getDb();
  const id = newId();
  const now = new Date();
  const expires = new Date(now.getTime() + (p.expiresInSec || 3600) * 1000);
  const authorityType = normalizeAuthorityType(p.authorityType);
  // one active connection per user+mode+authority (individual and agent can coexist)
  database
    .prepare(
      `DELETE FROM hmrc_connections
       WHERE user_id = ? AND mode = ? AND authority_type = ? AND revoked_at IS NULL`
    )
    .run(p.userId, p.mode, authorityType);
  database
    .prepare(
      `INSERT INTO hmrc_connections (
        id, user_id, firm_id, mode, authority_type,
        access_token_enc, refresh_token_enc, scopes, expires_at, created_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    .run(
      id,
      p.userId,
      p.firmId || null,
      p.mode,
      authorityType,
      encryptSecret(p.accessToken),
      p.refreshToken ? encryptSecret(p.refreshToken) : null,
      p.scopes || DEFAULT_SCOPES,
      expires.toISOString(),
      now.toISOString()
    );
  return {
    id,
    mode: p.mode,
    authorityType,
    expiresAt: expires.toISOString(),
    mock: String(p.accessToken).startsWith('mock-'),
  };
}

/**
 * @param {string} userId
 */
/**
 * True when token is a local mock (never a real HMRC-issued token).
 * @param {string|null|undefined} token
 */
export function isMockAccessToken(token) {
  return Boolean(token && String(token).startsWith('mock-'));
}

/**
 * @param {string} userId
 * @param {{ authorityType?: string }} [opts]
 */
export function getActiveConnection(userId, opts = {}) {
  const prefer = opts.authorityType
    ? normalizeAuthorityType(opts.authorityType)
    : null;
  const row = prefer
    ? getDb()
        .prepare(
          `SELECT * FROM hmrc_connections
           WHERE user_id = ? AND authority_type = ? AND revoked_at IS NULL
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(userId, prefer)
    : getDb()
        .prepare(
          `SELECT * FROM hmrc_connections
           WHERE user_id = ? AND revoked_at IS NULL
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(userId);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    return {
      id: row.id,
      mode: row.mode,
      authorityType: row.authority_type,
      expiresAt: row.expires_at,
      scopes: row.scopes,
      expired: true,
      accessToken: null,
      mock: false,
    };
  }
  const accessToken = decryptSecret(row.access_token_enc);
  const mock = isMockAccessToken(accessToken);
  return {
    id: row.id,
    mode: row.mode,
    authorityType: row.authority_type,
    expiresAt: row.expires_at,
    scopes: row.scopes,
    accessToken,
    expired: false,
    mock,
  };
}

/**
 * @param {string} userId
 */
export function revokeConnection(userId) {
  getDb()
    .prepare(
      `UPDATE hmrc_connections SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`
    )
    .run(new Date().toISOString(), userId);
}
