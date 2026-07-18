/**
 * Production-safe boot checks. Refuse to start when secrets/cookies are weak.
 */

const DEV_TOKEN_KEY = 'dev-only-spreadsheet-tax-token-key!!';

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true, mode: string } | { ok: false, errors: string[] }}
 */
export function evaluateProductionSafety(env = process.env) {
  const force = env.FORCE_PRODUCTION_SAFETY === '1';
  const isProd = env.NODE_ENV === 'production' || force;
  if (!isProd) {
    return { ok: true, mode: 'non-production' };
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

  // Live submit accidentally on without production OAuth env is still sandbox-safe,
  // but production OAuth env without allow flag is fine. Block anonymous live path:
  if (
    env.HMRC_ALLOW_LIVE_SUBMIT === '1' &&
    env.HMRC_OAUTH_ENV === 'production' &&
    env.ALLOW_ANONYMOUS_LIVE_SUBMIT === '1'
  ) {
    errors.push(
      'ALLOW_ANONYMOUS_LIVE_SUBMIT cannot be enabled with production live submit'
    );
  }

  if (errors.length) {
    return { ok: false, errors, mode: 'production' };
  }
  return { ok: true, mode: 'production' };
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
