/**
 * Rate limiting — Redis when available, else SQLite counters.
 * Tiers: IP, user, firm, route-class.
 */

import { getDb } from './db.js';
import { redisRateLimit } from './redis-client.js';

/**
 * @param {string} key
 * @param {number} max
 * @param {number} windowMs
 * @returns {Promise<boolean>} true if allowed
 */
export async function checkRateLimit(key, max, windowMs) {
  try {
    const redisResult = await redisRateLimit(key, max, windowMs);
    if (redisResult !== null && redisResult !== undefined) return redisResult;
  } catch {
    /* fall through */
  }
  return dbRateLimit(key, max, windowMs);
}

function dbRateLimit(key, max, windowMs) {
  const database = getDb();
  const now = Date.now();
  const row = database.prepare(`SELECT * FROM rate_limits WHERE key = ?`).get(key);
  if (!row) {
    database
      .prepare(`INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)`)
      .run(key, new Date(now).toISOString());
    return true;
  }
  const start = new Date(row.window_start).getTime();
  if (now - start > windowMs) {
    database
      .prepare(`UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?`)
      .run(new Date(now).toISOString(), key);
    return true;
  }
  if (row.count >= max) return false;
  database.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).run(key);
  return true;
}

/** Default route tiers (overridable via env) */
export const RATE_TIERS = {
  api_global_ip: {
    max: Number(process.env.RL_API_IP_MAX || 300),
    windowMs: Number(process.env.RL_API_IP_WINDOW_MS || 60_000),
  },
  auth_login: {
    max: Number(process.env.RL_LOGIN_MAX || 20),
    windowMs: 60_000,
  },
  auth_register: {
    max: Number(process.env.RL_REGISTER_MAX || 10),
    windowMs: 60_000,
  },
  submit: {
    max: Number(process.env.RL_SUBMIT_MAX || 30),
    windowMs: 60_000,
  },
  import: {
    max: Number(process.env.RL_IMPORT_MAX || 40),
    windowMs: 60_000,
  },
  firm_write: {
    max: Number(process.env.RL_FIRM_WRITE_MAX || 120),
    windowMs: 60_000,
  },
};

/**
 * @param {import('express').Request} req
 */
export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Express middleware: global IP rate limit for /api/*
 */
export function apiRateLimitMiddleware() {
  const tier = RATE_TIERS.api_global_ip;
  return async function apiRateLimit(req, res, next) {
    if (!req.path.startsWith('/api')) return next();
    // Never rate-limit health probes
    if (req.path === '/api/status' || req.path === '/health' || req.path === '/readyz') {
      return next();
    }
    const ip = clientIp(req);
    const ok = await checkRateLimit(`api_ip:${ip}`, tier.max, tier.windowMs);
    if (!ok) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({
        error: 'Too many requests from this network. Try again shortly.',
        code: 'RATE_LIMIT_IP',
      });
    }
    return next();
  };
}

/**
 * Multi-key check (all must pass).
 * @param {{ key: string, max: number, windowMs: number }[]} checks
 */
export async function checkAllRateLimits(checks) {
  for (const c of checks) {
    const ok = await checkRateLimit(c.key, c.max, c.windowMs);
    if (!ok) return false;
  }
  return true;
}
