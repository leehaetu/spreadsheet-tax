/**
 * HMRC fraud-prevention header builder (subset suitable for web apps).
 * Values are best-effort from request metadata; production should enrich.
 * @see https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 */

/**
 * @param {import('express').Request | null} req
 * @param {{ vendorVersion?: string }} [opts]
 */
export function buildFraudPreventionHeaders(req, opts = {}) {
  const vendorVersion = opts.vendorVersion || '1.0.0';
  const ua = req?.headers?.['user-agent'] || 'unknown';
  const ip =
    (typeof req?.headers?.['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : null) ||
    req?.socket?.remoteAddress ||
    '127.0.0.1';

  /** @type {Record<string, string>} */
  const headers = {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-Browser-JS-User-Agent': String(ua).slice(0, 500),
    'Gov-Vendor-Version': `SpreadsheetTax=${vendorVersion}`,
    'Gov-Vendor-Product-Name': 'SpreadsheetTax',
    'Gov-Client-Public-IP': String(ip).replace(/^::ffff:/, ''),
    'Gov-Vendor-Public-IP': String(ip).replace(/^::ffff:/, ''),
  };

  // Timezone offset minutes if client sent it
  const tz = req?.headers?.['x-client-timezone-offset'];
  if (tz != null && String(tz).match(/^-?\d+$/)) {
    headers['Gov-Client-Timezone'] = `UTC${Number(tz) >= 0 ? '+' : ''}${String(
      Math.floor(Number(tz) / 60)
    ).padStart(2, '0')}:${String(Math.abs(Number(tz) % 60)).padStart(2, '0')}`;
  }

  return headers;
}
