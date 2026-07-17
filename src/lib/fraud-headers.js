/**
 * HMRC fraud-prevention headers for WEB_APP_VIA_SERVER.
 *
 * HONESTY RULE: only emit a header when we have a real source for its value.
 * Never invent ports, screen sizes, timezones, IPs, or MFA. Missing data is
 * omitted; HMRC document "missing header data" for production approval.
 *
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/getting-it-right/#missing-header-data
 */

import crypto from 'node:crypto';

const VENDOR_PRODUCT = 'SpreadsheetTax';

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
 * Client-persisted device UUID only. Do not invent a stable id from UA+IP
 * (that is not a device UUID stored on the originating device).
 * @param {import('express').Request | null} req
 */
function resolveDeviceId(req) {
  const fromClient = req?.headers?.['x-client-device-id'];
  if (fromClient && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(fromClient))) {
    return String(fromClient).toLowerCase();
  }
  return null;
}

/**
 * Best-effort client public IP from reverse-proxy headers or direct socket.
 * @param {import('express').Request | null} req
 */
function clientPublicIp(req) {
  if (!req) return null;
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim().replace(/^::ffff:/, '');
  }
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim().replace(/^::ffff:/, '');
  }
  const raw = req.socket?.remoteAddress;
  if (!raw) return null;
  return String(raw).replace(/^::ffff:/, '');
}

/**
 * Vendor (our server edge) public IP — only if configured.
 * Do not fake vendor IP as the client IP.
 * @returns {string|null}
 */
function vendorPublicIp() {
  if (process.env.VENDOR_PUBLIC_IP) {
    return String(process.env.VENDOR_PUBLIC_IP).trim();
  }
  return null;
}

/**
 * Client public TCP port — only if a proxy or client reports a real value.
 * Never invent a port. Never use 80/443.
 * @param {import('express').Request | null} req
 */
function clientPublicPort(req) {
  if (!req) return null;
  const candidates = [
    req.headers?.['x-client-public-port'],
    req.headers?.['x-forwarded-port'],
    // Some platforms expose the client port on the request; only use if not server ports
  ];
  for (const c of candidates) {
    if (c == null || c === '') continue;
    // X-Forwarded-Port may be a list
    const first = String(c).split(',')[0].trim();
    if (!/^\d+$/.test(first)) continue;
    const p = Number(first);
    if (p >= 1 && p <= 65535 && p !== 80 && p !== 443) return String(p);
  }
  return null;
}

function isoNowMs() {
  const d = new Date();
  // Ensure milliseconds including trailing zeros style HMRC example
  return d.toISOString();
}

/**
 * Build only headers with honest sources.
 *
 * Client should send (from browser JS):
 * - X-Client-Device-Id (UUID in localStorage)
 * - X-Client-Timezone-Offset (minutes east of UTC)
 * - X-Client-Window-Size (WxH)
 * - X-Client-Screens (WxH)
 * - X-Client-Public-Port only if a real client port is known (usually not available)
 *
 * Server:
 * - Client IP from X-Forwarded-For / X-Real-IP / socket
 * - Vendor IP only from VENDOR_PUBLIC_IP env (configure Railway egress IP)
 *
 * @param {import('express').Request | null} req
 * @param {{
 *   vendorVersion?: string,
 *   userId?: string|null,
 * }} [opts]
 * @returns {{ headers: Record<string, string>, omitted: Array<{ header: string, reason: string }> }}
 */
export function buildFraudPreventionHeadersDetailed(req, opts = {}) {
  const vendorVersion = opts.vendorVersion || process.env.APP_VERSION || '1.8.1';
  /** @type {Record<string, string>} */
  const headers = {};
  /** @type {Array<{ header: string, reason: string }>} */
  const omitted = [];

  headers['Gov-Client-Connection-Method'] = 'WEB_APP_VIA_SERVER';

  // User-Agent from browser (real request header)
  const ua = req?.headers?.['user-agent'];
  if (ua) {
    headers['Gov-Client-Browser-JS-User-Agent'] = String(ua).slice(0, 500);
  } else {
    omitted.push({
      header: 'Gov-Client-Browser-JS-User-Agent',
      reason: 'No User-Agent on request',
    });
  }

  const deviceId = resolveDeviceId(req);
  if (deviceId) {
    headers['Gov-Client-Device-ID'] = deviceId;
  } else {
    omitted.push({
      header: 'Gov-Client-Device-ID',
      reason:
        'Client must send X-Client-Device-Id (persistent UUID). Server will not invent a device id.',
    });
  }

  const clientIp = clientPublicIp(req);
  if (clientIp) {
    headers['Gov-Client-Public-IP'] = clientIp;
    headers['Gov-Client-Public-IP-Timestamp'] = isoNowMs();
  } else {
    omitted.push({
      header: 'Gov-Client-Public-IP',
      reason: 'No client IP available from proxy headers or socket',
    });
  }

  const port = clientPublicPort(req);
  if (port) {
    headers['Gov-Client-Public-Port'] = port;
  } else {
    omitted.push({
      header: 'Gov-Client-Public-Port',
      reason:
        'Browser web apps cannot observe client public TCP port; no honest value available. Do not invent.',
    });
  }

  const screens = req?.headers?.['x-client-screens'];
  if (screens && /^\d+x\d+$/.test(String(screens))) {
    const [w, h] = String(screens).split('x');
    // colour-depth / scaling: browser can report via window.devicePixelRatio and screen.colorDepth — require client send full form
    const scale = req?.headers?.['x-client-screen-scale'];
    const depth = req?.headers?.['x-client-screen-depth'];
    const scaling =
      scale && Number(scale) > 0 ? String(scale) : null;
    const colour = depth && /^\d+$/.test(String(depth)) ? String(depth) : null;
    if (scaling && colour) {
      headers['Gov-Client-Screens'] =
        `width=${w}&height=${h}&scaling-factor=${scaling}&colour-depth=${colour}`;
    } else {
      omitted.push({
        header: 'Gov-Client-Screens',
        reason:
          'Need width, height, scaling-factor and colour-depth from client; incomplete client metadata',
      });
    }
  } else {
    omitted.push({
      header: 'Gov-Client-Screens',
      reason: 'Client did not send X-Client-Screens (real screen size)',
    });
  }

  const windowSize = req?.headers?.['x-client-window-size'];
  if (windowSize && /^\d+x\d+$/.test(String(windowSize))) {
    const [w, h] = String(windowSize).split('x');
    headers['Gov-Client-Window-Size'] = `width=${w}&height=${h}`;
  } else {
    omitted.push({
      header: 'Gov-Client-Window-Size',
      reason: 'Client did not send X-Client-Window-Size',
    });
  }

  const tz = req?.headers?.['x-client-timezone-offset'];
  if (tz != null && String(tz).match(/^-?\d+$/)) {
    const formatted = formatGovClientTimezone(Number(tz));
    if (formatted) headers['Gov-Client-Timezone'] = formatted;
  } else {
    omitted.push({
      header: 'Gov-Client-Timezone',
      reason: 'Client did not send X-Client-Timezone-Offset',
    });
  }

  const userId = opts.userId || req?.headers?.['x-client-user-id'];
  if (userId) {
    headers['Gov-Client-User-IDs'] =
      `spreadsheet-tax=${encodeURIComponent(String(userId).slice(0, 64))}`;
  } else {
    omitted.push({
      header: 'Gov-Client-User-IDs',
      reason: 'No signed-in user id for this request',
    });
  }

  // MFA: only if real MFA was used — password-only means omit and document to HMRC
  const mfa = req?.headers?.['x-client-multi-factor'];
  if (mfa && String(mfa).trim()) {
    headers['Gov-Client-Multi-Factor'] = String(mfa).slice(0, 500);
  } else {
    omitted.push({
      header: 'Gov-Client-Multi-Factor',
      reason:
        'Single-factor (email/password) auth only — no MFA event to report',
    });
  }

  const vendorIp = vendorPublicIp();
  if (vendorIp) {
    headers['Gov-Vendor-Public-IP'] = vendorIp;
  } else {
    omitted.push({
      header: 'Gov-Vendor-Public-IP',
      reason:
        'Set VENDOR_PUBLIC_IP to the real public IP of the edge that receives client TLS (Railway egress). Do not copy client IP.',
    });
  }

  if (clientIp && vendorIp) {
    headers['Gov-Vendor-Forwarded'] =
      `by=${encodeURIComponent(vendorIp)}&for=${encodeURIComponent(clientIp)}`;
  } else {
    omitted.push({
      header: 'Gov-Vendor-Forwarded',
      reason: 'Requires both client and vendor public IPs',
    });
  }

  headers['Gov-Vendor-Version'] = `${VENDOR_PRODUCT}=${vendorVersion}`;
  headers['Gov-Vendor-Product-Name'] = encodeURIComponent(VENDOR_PRODUCT);

  // License: product is proprietary (Lee Hine) — hash of published license statement is a real product attribute
  headers['Gov-Vendor-License-IDs'] =
    `${VENDOR_PRODUCT}=${crypto
      .createHash('sha256')
      .update('Spreadsheet Tax proprietary license — Lee Hine')
      .digest('hex')
      .toUpperCase()}`;

  const localIps = req?.headers?.['x-client-local-ips'];
  if (localIps && String(localIps).length < 200) {
    headers['Gov-Client-Local-IPs'] = String(localIps);
    headers['Gov-Client-Local-IPs-Timestamp'] = isoNowMs();
  }

  return { headers, omitted };
}

/**
 * Back-compat: return headers only.
 * @param {import('express').Request | null} req
 * @param {{ vendorVersion?: string, userId?: string|null }} [opts]
 */
export function buildFraudPreventionHeaders(req, opts = {}) {
  return buildFraudPreventionHeadersDetailed(req, opts).headers;
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
    'Gov-Vendor-Version',
    'Gov-Vendor-Product-Name',
    'Gov-Vendor-Public-IP',
    'Gov-Vendor-Forwarded',
    'Gov-Vendor-License-IDs',
  ];
}
