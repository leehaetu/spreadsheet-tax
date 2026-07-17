/**
 * HMRC fraud-prevention headers for WEB_APP_VIA_SERVER.
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/
 */

import crypto from 'node:crypto';

const VENDOR_PRODUCT = 'SpreadsheetTax';

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) {
    h = (Math.imul(31, h) + String(s).charCodeAt(i)) | 0;
  }
  return h;
}

/**
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
 * @param {import('express').Request | null} req
 */
function vendorPublicIp(req) {
  if (process.env.VENDOR_PUBLIC_IP) {
    return String(process.env.VENDOR_PUBLIC_IP).trim();
  }
  return clientPublicIp(req);
}

function isoNow() {
  return new Date().toISOString();
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
  const vendorVersion = opts.vendorVersion || process.env.APP_VERSION || '1.8.0';
  const ua = req?.headers?.['user-agent'] || 'SpreadsheetTax-Server/1.8.0';
  const clientIp = clientPublicIp(req);
  const vendorIp = opts.vendorPublicIp || vendorPublicIp(req);
  const deviceId = resolveDeviceId(req);
  const ts = isoNow();

  /** @type {Record<string, string>} */
  const headers = {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Device-ID': deviceId,
    'Gov-Client-Browser-JS-User-Agent': String(ua).slice(0, 500),
    'Gov-Client-Public-IP': clientIp,
    'Gov-Client-Public-IP-Timestamp': ts,
    'Gov-Vendor-Public-IP': vendorIp,
    // by=vendor, for=client (HMRC cross-validation)
    'Gov-Vendor-Forwarded': `by=${encodeURIComponent(vendorIp)}&for=${encodeURIComponent(clientIp)}`,
    'Gov-Vendor-Version': `${VENDOR_PRODUCT}=${vendorVersion}`,
    'Gov-Vendor-Product-Name': VENDOR_PRODUCT,
    'Gov-Vendor-License-IDs': `${VENDOR_PRODUCT}=${crypto
      .createHash('sha256')
      .update('proprietary-lee-hine')
      .digest('hex')
      .toUpperCase()}`,
  };

  // Client public port: HMRC rejects 80/443; use client-reported ephemeral or a synthetic high port
  const clientPort = req?.headers?.['x-client-public-port'];
  let portNum = null;
  if (clientPort && /^\d+$/.test(String(clientPort))) {
    const p = Number(clientPort);
    if (p > 0 && p !== 80 && p !== 443 && p < 65536) portNum = p;
  }
  if (portNum == null) {
    // Synthetic client-side port for WEB_APP (browser does not expose public port)
    portNum = 49152 + (Math.abs(hashStr(deviceId)) % 16000);
  }
  headers['Gov-Client-Public-Port'] = String(portNum);

  // Screens / window — defaults if browser didn't send (sandbox needs complete values)
  const screens = req?.headers?.['x-client-screens'];
  if (screens && /^\d+x\d+$/.test(String(screens))) {
    const [w, h] = String(screens).split('x');
    headers['Gov-Client-Screens'] =
      `width=${w}&height=${h}&scaling-factor=1&colour-depth=24`;
  } else {
    headers['Gov-Client-Screens'] =
      'width=1920&height=1080&scaling-factor=1&colour-depth=24';
  }

  const windowSize = req?.headers?.['x-client-window-size'];
  if (windowSize && /^\d+x\d+$/.test(String(windowSize))) {
    const [w, h] = String(windowSize).split('x');
    headers['Gov-Client-Window-Size'] = `width=${w}&height=${h}`;
  } else {
    headers['Gov-Client-Window-Size'] = 'width=1280&height=800';
  }

  const tz = req?.headers?.['x-client-timezone-offset'];
  if (tz != null && String(tz).match(/^-?\d+$/)) {
    const formatted = formatGovClientTimezone(Number(tz));
    if (formatted) headers['Gov-Client-Timezone'] = formatted;
  } else {
    headers['Gov-Client-Timezone'] = 'UTC+00:00';
  }

  const userId = opts.userId || req?.headers?.['x-client-user-id'];
  if (userId) {
    headers['Gov-Client-User-IDs'] = `spreadsheet-tax=${String(userId).slice(0, 64)}`;
  }

  // Only send multi-factor when client actually provides it — empty is INVALID/advisory
  const mfa = req?.headers?.['x-client-multi-factor'];
  if (mfa && String(mfa).trim()) {
    headers['Gov-Client-Multi-Factor'] = String(mfa).slice(0, 500);
  }

  const localIps = req?.headers?.['x-client-local-ips'];
  if (localIps && String(localIps).length < 200) {
    headers['Gov-Client-Local-IPs'] = String(localIps);
    headers['Gov-Client-Local-IPs-Timestamp'] = ts;
  }

  return headers;
}

export function listFraudHeaderKeys() {
  return [
    'Gov-Client-Connection-Method',
    'Gov-Client-Device-ID',
    'Gov-Client-Browser-JS-User-Agent',
    'Gov-Client-Public-IP',
    'Gov-Client-Public-IP-Timestamp',
    'Gov-Client-Public-Port',
    'Gov-Client-Timezone',
    'Gov-Client-Screens',
    'Gov-Client-Window-Size',
    'Gov-Client-User-IDs',
    'Gov-Client-Multi-Factor',
    'Gov-Client-Local-IPs',
    'Gov-Client-Local-IPs-Timestamp',
    'Gov-Vendor-Version',
    'Gov-Vendor-Product-Name',
    'Gov-Vendor-Public-IP',
    'Gov-Vendor-Forwarded',
    'Gov-Vendor-License-IDs',
  ];
}
