/**
 * Redis for sessions, rate limits, distributed locks (capacity path).
 */

import Redis from 'ioredis';
import { isRedisEnabled } from './platform-config.js';

/** @type {import('ioredis').default | null} */
let client = null;

export function getRedis() {
  if (!isRedisEnabled()) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    client.on('error', (err) => {
      console.error('[redis]', err.message);
    });
  }
  return client;
}

export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
  }
}

/**
 * Sliding-window style counter rate limit.
 * @param {string} key
 * @param {number} max
 * @param {number} windowMs
 * @returns {Promise<boolean>} true if allowed
 */
export async function redisRateLimit(key, max, windowMs) {
  const r = getRedis();
  if (!r) return null; // signal caller to use DB fallback
  const rk = `rl:${key}`;
  const n = await r.incr(rk);
  if (n === 1) await r.pexpire(rk, windowMs);
  return n <= max;
}

/**
 * @param {string} lockKey
 * @param {string} token
 * @param {number} ttlMs
 */
export async function redisAcquireLock(lockKey, token, ttlMs) {
  const r = getRedis();
  if (!r) return false;
  const res = await r.set(`lock:${lockKey}`, token, 'PX', ttlMs, 'NX');
  return res === 'OK';
}

/**
 * @param {string} lockKey
 * @param {string} token
 */
export async function redisReleaseLock(lockKey, token) {
  const r = getRedis();
  if (!r) return;
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end`;
  await r.eval(script, 1, `lock:${lockKey}`, token);
}

/**
 * Session blob in Redis (optional secondary store).
 * @param {string} sessionId
 * @param {object} data
 * @param {number} ttlSeconds
 */
export async function redisSetSession(sessionId, data, ttlSeconds) {
  const r = getRedis();
  if (!r) return false;
  await r.set(`sess:${sessionId}`, JSON.stringify(data), 'EX', ttlSeconds);
  return true;
}

/**
 * @param {string} sessionId
 */
export async function redisGetSession(sessionId) {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get(`sess:${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} sessionId
 */
export async function redisDelSession(sessionId) {
  const r = getRedis();
  if (!r) return;
  await r.del(`sess:${sessionId}`);
}
