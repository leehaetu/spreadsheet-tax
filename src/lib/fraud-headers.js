/**
 * HMRC fraud-prevention headers for WEB_APP_VIA_SERVER.
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/
 *
 * Headers are built from request metadata + optional client-supplied fields.
 * Full production approval still requires HMRC validation of the pack.
 */

import crypto from 'node:crypto';

const VENDOR_PRODUCT = 'SpreadsheetTax';

/**
 * Format timezone as UTC±HH:MM from offset minutes (JS getTimezoneOffset is inverted:
 * client should send minutes east of UTC, or we invert getTimezoneOffset).
 * @param {number} offsetMinutesEastOfUtc
 */
export function formatGovClientTimezone(offsetMinutesEastOfUtc) {
  const n = Number(offsetMinutesEastOfUtc);
  if (!Number.isFinite(n)) return null;
  const sign = n >= 0 ? '+' : '-';
  const abs = Math.abs(Math.trunc(n));
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Stable-ish device id: use client-supplied UUID or derive from UA+IP (not a hardware id).
 * @param {import('express').Request | null} req
 */
function resolveDeviceId(req) {
  const fromClient = req?.headers?.['x-client-device-id'];
  if (fromClient && /^[0-9a-f-]{36}$/i.test(String(fromClient))) {
    return String(fromClient).toLowerCase();
  }
  const ua = req?.headers?.['user-agent'] || 'unknown';
  const ip = clientPublicIp(req);
  return crypto
    .createHash('sha256')
    .update(`st-device|${ua}|${ip}`)
    .digest('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
}

/**
 * @param {import('express').Request | null} req
 */
function clientPublicIp(req) {
  const xf = req?.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim().replace(/^::ffff:/, '');
  }
  const raw = req?.socket?.remoteAddress || '127.0.0.1';
  return String(raw).replace(/^::ffff:/, '');
}

/**
 * Vendor public IP: server egress if configured, else request IP (common on single-box hosts).
 * @param {import('express').Request | null} req
 */
function vendorPublicIp(req) {
  if (process.env.VENDOR_PUBLIC_IP) {
    return String(process.env.VENDOR_PUBLIC_IP).trim();
  }
  return clientPublicIp(req);
}

/**
 * @param {import('express').Request | null} req
 * @param {{
 *   vendorVersion?: string,
 *   userId?: string|null,
 *   vendorPublicIp?: string|null,
 * }} [opts]
 * @returns {Record<string, string>}
 */
export function buildFraudPreventionHeaders(req, opts = {}) {
  const vendorVersion = opts.vendorVersion || process.env.APP_VERSION || '1.7.0';
  const ua = req?.headers?.['user-agent'] || 'unknown';
  const clientIp = clientPublicIp(req);
  const vendorIp = opts.vendorPublicIp || vendorPublicIp(req);
  const deviceId = resolveDeviceId(req);

  /** @type {Record<string, string>} */
  const headers = {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Device-ID': deviceId,
    'Gov-Client-Browser-JS-User-Agent': String(ua).slice(0, 500),
    'Gov-Client-Public-IP': clientIp,
    'Gov-Vendor-Public-IP': vendorIp,
    'Gov-Vendor-Version': `${VENDOR_PRODUCT}=${vendorVersion}`,
    'Gov-Vendor-Product-Name': VENDOR_PRODUCT,
  };

  // Browser window size if client sent it (WxH)
  const screens = req?.headers?.['x-client-screens'];
  if (screens && /^\d+x\d+$/.test(String(screens))) {
    headers['Gov-Client-Screens'] =
      `width=${String(screens).split('x')[0]}&height=${String(screens).split('x')[1]}&scaling-factor=1&colour-depth=24`;
  }

  const windowSize = req?.headers?.['x-client-window-size'];
  if (windowSize && /^\d+x\d+$/.test(String(windowSize))) {
    const [w, h] = String(windowSize).split('x');
    headers['Gov-Client-Window-Size'] = `width=${w}&height=${h}`;
  }

  // Timezone: prefer client minutes east of UTC (x-client-timezone-offset)
  // Browser getTimezoneOffset() is minutes *west* of UTC — app inverts before send.
  const tz = req?.headers?.['x-client-timezone-offset'];
  if (tz != null && String(tz).match(/^-?\d+$/)) {
    const formatted = formatGovClientTimezone(Number(tz));
    if (formatted) headers['Gov-Client-Timezone'] = formatted;
  }

  const userId = opts.userId || req?.headers?.['x-client-user-id'];
  if (userId) {
    headers['Gov-Client-User-IDs'] = `spreadsheet-tax=${String(userId).slice(0, 64)}`;
  }

  // Multi-factor: web apps often report none for password-only sessions
  headers['Gov-Client-Multi-Factor'] = '';

  // Vendor license / product ids for software identification
  headers['Gov-Vendor-License-IDs'] = `${VENDOR_PRODUCT}=proprietary-lee-hine`;

  // Local IPs are often unavailable behind reverse proxy; omit rather than invent
  const localIps = req?.headers?.['x-client-local-ips'];
  if (localIps && String(localIps).length < 200) {
    headers['Gov-Client-Local-IPs'] = String(localIps);
  }

  return headers;
}

/**
 * List header keys we emit (for integrity / inspection).
 */
export function listFraudHeaderKeys() {
  return [
    'Gov-Client-Connection-Method',
    'Gov-Client-Device-ID',
    'Gov-Client-Browser-JS-User-Agent',
    'Gov-Client-Public-IP',
    'Gov-Client-Timezone',
    'Gov-Client-Screens',
    'Gov-Client-Window-Size',
    'Gov-Client-User-IDs',
    'Gov-Client-Multi-Factor',
    'Gov-Client-Local-IPs',
    'Gov-Vendor-Version',
    'Gov-Vendor-Product-Name',
    'Gov-Vendor-Public-IP',
    'Gov-Vendor-License-IDs',
  ];
}
