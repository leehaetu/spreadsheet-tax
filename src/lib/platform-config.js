/**
 * Platform / capacity mode detection.
 * Scale claims require DATABASE_URL (Postgres) — see docs/CAPACITY-REQUIREMENTS.md
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isPostgresMode(env = process.env) {
  return Boolean(env.DATABASE_URL && String(env.DATABASE_URL).trim());
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isRedisEnabled(env = process.env) {
  return Boolean(env.REDIS_URL && String(env.REDIS_URL).trim());
}

/**
 * Production capacity posture: Postgres required when CAPACITY_ENFORCE=1 or
 * when claiming multi-instance (WEB_CONCURRENCY > 1).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function evaluateCapacityPlatform(env = process.env) {
  const enforce =
    env.CAPACITY_ENFORCE === '1' ||
    env.NODE_ENV === 'production' && env.CAPACITY_ENFORCE !== '0';
  /** @type {string[]} */
  const missing = [];
  if (enforce) {
    if (!isPostgresMode(env)) missing.push('DATABASE_URL (managed PostgreSQL)');
    if (!isRedisEnabled(env)) missing.push('REDIS_URL (sessions/rate limits/locks)');
    if (!env.OBJECT_STORAGE_DIR && !env.S3_BUCKET) {
      missing.push('OBJECT_STORAGE_DIR or S3_BUCKET (encrypted object storage root)');
    }
  }
  return {
    enforce,
    ok: missing.length === 0,
    missing,
    postgres: isPostgresMode(env),
    redis: isRedisEnabled(env),
    mode: isPostgresMode(env) ? 'postgres' : 'sqlite',
  };
}
