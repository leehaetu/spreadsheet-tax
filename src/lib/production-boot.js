/**
 * Production-safe boot checks. Refuse to start when secrets/cookies are weak.
 * Capacity posture: when CAPACITY_ENFORCE=1, require Postgres/Redis/object storage.
 */

import { evaluateCapacityPlatform } from './platform-config.js';

const DEV_TOKEN_KEY = 'dev-only-spreadsheet-tax-token-key!!';

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true, mode: string, capacity?: object } | { ok: false, errors: string[], mode: string }}
 */
export function evaluateProductionSafety(env = process.env) {
  const force = env.FORCE_PRODUCTION_SAFETY === '1';
  const isProd = env.NODE_ENV === 'production' || force;
  if (!isProd) {
    return {
      ok: true,
      mode: 'non-production',
      capacity: evaluateCapacityPlatform(env),
    };
  }

  /** @type {string[]} */
  const errors = [];

  const session = env.SESSION_SECRET || '';
  if (session.length < 32) {
    errors.push(
      'SESSION_SECRET must be set and at least 32 characters in production'
    );
  }

  const tokenKey = env.TOKEN_ENCRYPTION_KEY || '';
  if (tokenKey.length < 32) {
    errors.push(
      'TOKEN_ENCRYPTION_KEY must be set and at least 32 characters in production'
    );
  }
  if (!tokenKey || tokenKey === DEV_TOKEN_KEY) {
    errors.push('TOKEN_ENCRYPTION_KEY must not use the development fallback key');
  }
  if (tokenKey && session && tokenKey === session) {
    errors.push(
      'TOKEN_ENCRYPTION_KEY must be distinct from SESSION_SECRET in production'
    );
  }

  if (env.COOKIE_SECURE !== '1') {
    errors.push('COOKIE_SECURE=1 is required in production (Secure session cookies)');
  }

  if (
    env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
    env.HMRC_OAUTH_ENV === 'production' &&
    env.ALLOW_ANONYMOUS_LIVE_SUBMIT === '1'
  ) {
    errors.push(
      'ALLOW_ANONYMOUS_LIVE_SUBMIT cannot be enabled with production live submit'
    );
  }

  // Production HMRC APIs: require Hub client credentials when live + production host
  if (
    env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
    env.HMRC_OAUTH_ENV === 'production'
  ) {
    if (!env.HMRC_CLIENT_ID || String(env.HMRC_CLIENT_ID).length < 8) {
      errors.push(
        'HMRC_CLIENT_ID required when HMRC_ALLOW_LIVE_SUBMIT=1 and HMRC_OAUTH_ENV=production'
      );
    }
    if (!env.HMRC_CLIENT_SECRET || String(env.HMRC_CLIENT_SECRET).length < 8) {
      errors.push(
        'HMRC_CLIENT_SECRET required when HMRC_ALLOW_LIVE_SUBMIT=1 and HMRC_OAUTH_ENV=production'
      );
    }
  }

  // Hard capacity platform (200 practices / 800k) — enforce when CAPACITY_ENFORCE=1
  // or when NODE_ENV=production and CAPACITY_ENFORCE is not explicitly 0
  const capacity = evaluateCapacityPlatform({
    ...env,
    CAPACITY_ENFORCE:
      env.CAPACITY_ENFORCE === '1'
        ? '1'
        : env.CAPACITY_ENFORCE === '0'
          ? '0'
          : env.CAPACITY_ENFORCE || '0',
  });
  if (env.CAPACITY_ENFORCE === '1' && !capacity.ok) {
    for (const m of capacity.missing) {
      errors.push(`Capacity platform: ${m}`);
    }
  }

  if (errors.length) {
    return { ok: false, errors, mode: 'production', capacity };
  }
  return { ok: true, mode: 'production', capacity };
}

/**
 * Throw if production safety fails. Call before listen.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function assertProductionBoot(env = process.env) {
  const result = evaluateProductionSafety(env);
  if (!result.ok) {
    const msg = `[production-boot] Refusing to start:\n- ${result.errors.join('\n- ')}`;
    throw new Error(msg);
  }
  return result;
}

export { DEV_TOKEN_KEY };
