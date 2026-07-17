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
 * @param {{ userId: string, state?: string }} opts
 */
export function buildAuthorizeUrl(opts) {
  const cfg = oauthConfig();
  const state = opts.state || crypto.randomBytes(16).toString('hex');
  // store state
  getDb()
    .prepare(
      `INSERT INTO oauth_states (id, user_id, created_at) VALUES (?, ?, ?)`
    )
    .run(state, opts.userId, new Date().toISOString());

  if (cfg.mock) {
    return {
      mock: true,
      state,
      url: `/api/hmrc/callback?code=mock-auth-code&state=${encodeURIComponent(state)}`,
    };
  }

  const authBase = cfg.mode === 'production' ? LIVE_AUTH : SANDBOX_AUTH;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    scope: process.env.HMRC_OAUTH_SCOPES || DEFAULT_SCOPES,
    state,
    redirect_uri: cfg.redirectUri,
  });
  return {
    mock: false,
    state,
    url: `${authBase}?${params.toString()}`,
  };
}

/**
 * @param {{ code: string, state: string }} opts
 */
export async function exchangeCodeForTokens(opts) {
  const cfg = oauthConfig();
  const row = getDb()
    .prepare(`SELECT * FROM oauth_states WHERE id = ?`)
    .get(opts.state);
  if (!row) {
    throw new Error('Invalid or expired OAuth state.');
  }
  getDb().prepare(`DELETE FROM oauth_states WHERE id = ?`).run(opts.state);

  if (cfg.mock || opts.code === 'mock-auth-code') {
    const access = `mock-access-${crypto.randomBytes(8).toString('hex')}`;
    const refresh = `mock-refresh-${crypto.randomBytes(8).toString('hex')}`;
    return saveConnection({
      userId: row.user_id,
      mode: 'sandbox',
      authorityType: 'individual',
      accessToken: access,
      refreshToken: refresh,
      scopes: DEFAULT_SCOPES,
      expiresInSec: 14400,
    });
  }

  const tokenUrl = cfg.mode === 'production' ? LIVE_TOKEN : SANDBOX_TOKEN;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
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
    authorityType: 'individual',
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
  // one active connection per user+mode
  database
    .prepare(
      `DELETE FROM hmrc_connections WHERE user_id = ? AND mode = ? AND revoked_at IS NULL`
    )
    .run(p.userId, p.mode);
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
      p.authorityType || 'individual',
      encryptSecret(p.accessToken),
      p.refreshToken ? encryptSecret(p.refreshToken) : null,
      p.scopes || DEFAULT_SCOPES,
      expires.toISOString(),
      now.toISOString()
    );
  return {
    id,
    mode: p.mode,
    expiresAt: expires.toISOString(),
    mock: String(p.accessToken).startsWith('mock-'),
  };
}

/**
 * @param {string} userId
 */
export function getActiveConnection(userId) {
  const row = getDb()
    .prepare(
      `SELECT * FROM hmrc_connections
       WHERE user_id = ? AND revoked_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    return { ...row, expired: true, accessToken: null };
  }
  return {
    id: row.id,
    mode: row.mode,
    authorityType: row.authority_type,
    expiresAt: row.expires_at,
    scopes: row.scopes,
    accessToken: decryptSecret(row.access_token_enc),
    expired: false,
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
