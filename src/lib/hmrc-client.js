/**
 * HMRC MTD ITSA client — sandbox HTTP implementation + in-process test double.
 * Both share the same request construction so unit tests drive real shapes.
 */

import { buildFraudPreventionHeaders } from './fraud-headers.js';
import {
  sanitizeUkPropertyPeriodBody,
  sanitizeForeignPropertyPeriodBody,
} from './hmrc-sandbox.js';

/** @typedef {{ userId?: string|null }} FraudOpts */

const DEFAULT_SANDBOX_BASE = 'https://test-api.service.hmrc.gov.uk';
const DEFAULT_PRODUCTION_BASE = 'https://api.service.hmrc.gov.uk';

/**
 * @typedef {object} HmrcConfig
 * @property {'sandbox' | 'double'} mode
 * @property {string} [baseUrl]
 * @property {string} [clientId]
 * @property {string} [clientSecret]
 * @property {string} [accessToken]
 * @property {string} [nino]
 * @property {import('express').Request | null} [req]
 * @property {string|null} [userId]
 */

/**
 * @typedef {object} SubmitRequest
 * @property {'self_employment' | 'uk_property' | 'foreign_property'} source
 * @property {string} nino
 * @property {string} businessId
 * @property {string} taxYear
 * @property {object} body - period summary payload
 * @property {string} [periodId] - for amend
 */

/**
 * Build the HTTP request descriptor (method, path, headers, body) for a quarterly submit.
 * Shared by sandbox and test double — this is the shippable request shape.
 * @param {SubmitRequest} req
 * @param {HmrcConfig} config
 */
export function buildSubmitRequest(req, config) {
  const base = (config.baseUrl || DEFAULT_SANDBOX_BASE).replace(/\/$/, '');
  const nino = req.nino || config.nino;
  if (!nino) {
    throw new Error('National Insurance number is required for HMRC request construction.');
  }
  const { businessId, taxYear, body, source, periodId } = req;
  if (!businessId) {
    throw new Error('HMRC business ID is required for HMRC request construction.');
  }
  if (!taxYear) {
    throw new Error('Tax year is required for HMRC request construction.');
  }

  let path;
  let method = 'POST';

  if (source === 'self_employment') {
    // Self-Employment Business (MTD) create period summary
    path = `/individuals/business/self-employment/${nino}/${businessId}/period`;
    if (periodId) {
      method = 'PUT';
      // SE 5.0 amend requires taxYear in path
      path = `/individuals/business/self-employment/${nino}/${businessId}/period/${taxYear}/${periodId}`;
    }
  } else if (source === 'uk_property') {
    path = `/individuals/business/property/uk/${nino}/${businessId}/period/${taxYear}`;
    if (periodId) {
      method = 'PUT';
      path = `/individuals/business/property/uk/${nino}/${businessId}/period/${taxYear}/${periodId}`;
    }
  } else if (source === 'foreign_property') {
    path = `/individuals/business/property/foreign/${nino}/${businessId}/period/${taxYear}`;
    if (periodId) {
      method = 'PUT';
      path = `/individuals/business/property/foreign/${nino}/${businessId}/period/${taxYear}/${periodId}`;
    }
  } else {
    throw new Error(`Unsupported income source: ${source}`);
  }

  // Accept version must match subscribed Hub API version
  // SE Business (MTD) 5.0 → vnd.hmrc.5.0+json; Property Business (MTD) 6.0 → vnd.hmrc.6.0+json
  let acceptVersion = process.env.HMRC_API_ACCEPT_VERSION || null;
  if (!acceptVersion) {
    if (source === 'self_employment') {
      acceptVersion = process.env.HMRC_SE_API_VERSION || '5.0';
    } else {
      acceptVersion = process.env.HMRC_PROPERTY_API_VERSION || '6.0';
    }
  }

  /** @type {Record<string, string>} */
  const headers = {
    Accept: `application/vnd.hmrc.${acceptVersion}+json`,
    'Content-Type': 'application/json',
    ...buildFraudPreventionHeaders(config.req || null, {
      userId: config.userId || null,
    }),
  };
  if (config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`;
  }

  // Property payloads keep periodDates for UI preview; strip before HMRC HTTP.
  let outboundBody = body;
  if (source === 'uk_property') {
    outboundBody = sanitizeUkPropertyPeriodBody(body);
  } else if (source === 'foreign_property') {
    outboundBody = sanitizeForeignPropertyPeriodBody(body);
  }

  return {
    method,
    url: `${base}${path}`,
    path,
    headers,
    body: outboundBody,
    source,
    nino,
    businessId,
    taxYear,
  };
}

/**
 * Create an HMRC client for the given config.
 * @param {Partial<HmrcConfig>} [overrides]
 */
export function createHmrcClient(overrides = {}) {
  const config = resolveConfig(overrides);

  return {
    mode: config.mode,
    config,
    buildSubmitRequest: (req) => buildSubmitRequest(req, config),
    /**
     * Submit a quarterly period summary for one income source.
     * @param {SubmitRequest} req
     */
    async submitPeriodSummary(req) {
      const prepared = buildSubmitRequest(req, config);
      if (config.mode === 'double') {
        return submitViaDouble(prepared);
      }
      return submitViaSandbox(prepared, config);
    },
    /**
     * Submit all available payloads from a quarterly bundle.
     * @param {object} payloads - from buildQuarterlyPayloads
     * @param {{ nino?: string, businessIdSe?: string, businessIdUk?: string, businessIdForeign?: string, taxYear?: string }} ids
     */
    async submitBundle(payloads, ids = {}) {
      const nino = ids.nino || payloads.meta?.nino || config.nino;
      const taxYear = ids.taxYear || payloads.meta?.taxYear;
      if (!nino || !taxYear) {
        throw new Error(
          'NINO and tax year must be provided by the validated submit path (no placeholder defaults).'
        );
      }
      const results = [];

      if (payloads.selfEmployment) {
        const businessId = ids.businessIdSe || payloads.meta?.businessId;
        if (!businessId) {
          throw new Error('Self-employment business ID required (no placeholder defaults).');
        }
        results.push(
          await this.submitPeriodSummary({
            source: 'self_employment',
            nino,
            businessId,
            taxYear,
            body: payloads.selfEmployment,
          })
        );
      }
      if (payloads.ukProperty) {
        const businessId = ids.businessIdUk || payloads.meta?.businessIdUk;
        if (!businessId) {
          throw new Error('UK property business ID required (no placeholder defaults).');
        }
        results.push(
          await this.submitPeriodSummary({
            source: 'uk_property',
            nino,
            businessId,
            taxYear,
            body: payloads.ukProperty,
          })
        );
      }
      if (payloads.foreignProperty) {
        const businessId =
          ids.businessIdForeign || payloads.meta?.businessIdForeign;
        if (!businessId) {
          throw new Error('Foreign property business ID required (no placeholder defaults).');
        }
        results.push(
          await this.submitPeriodSummary({
            source: 'foreign_property',
            nino,
            businessId,
            taxYear,
            body: payloads.foreignProperty,
          })
        );
      }

      return results;
    },
  };
}

/**
 * @param {Partial<HmrcConfig>} overrides
 * @returns {HmrcConfig}
 */
export function resolveConfig(overrides = {}) {
  const envMode = process.env.HMRC_MODE;
  const oauthEnv =
    process.env.HMRC_OAUTH_ENV === 'production' ? 'production' : 'sandbox';
  const clientId =
    'clientId' in overrides ? overrides.clientId : process.env.HMRC_CLIENT_ID;
  let mode = overrides.mode;
  if (!mode) {
    if (envMode === 'sandbox' || envMode === 'double') mode = envMode;
    // Access token present (user OAuth) → external host (sandbox or production by env)
    else if (overrides.accessToken || process.env.HMRC_ACCESS_TOKEN)
      mode = 'sandbox'; // label; host chosen below via oauth env
    else mode = clientId ? 'sandbox' : 'double';
  }
  const defaultBase =
    oauthEnv === 'production' ? DEFAULT_PRODUCTION_BASE : DEFAULT_SANDBOX_BASE;
  return {
    mode,
    baseUrl: overrides.baseUrl ?? process.env.HMRC_BASE_URL ?? defaultBase,
    oauthEnv,
    clientId,
    clientSecret:
      'clientSecret' in overrides
        ? overrides.clientSecret
        : process.env.HMRC_CLIENT_SECRET,
    accessToken:
      'accessToken' in overrides
        ? overrides.accessToken
        : process.env.HMRC_ACCESS_TOKEN,
    nino: overrides.nino ?? process.env.HMRC_NINO,
    req: overrides.req ?? null,
    userId: overrides.userId ?? null,
  };
}

/**
 * Pure helper: which HMRC API host for the current env (production switch).
 * @param {{ HMRC_OAUTH_ENV?: string, HMRC_BASE_URL?: string }} [env]
 */
export function resolveHmrcBaseUrl(env = process.env) {
  if (env.HMRC_BASE_URL) return String(env.HMRC_BASE_URL).replace(/\/$/, '');
  return env.HMRC_OAUTH_ENV === 'production'
    ? DEFAULT_PRODUCTION_BASE
    : DEFAULT_SANDBOX_BASE;
}

/**
 * In-process test double: accepts same request shape, returns success envelope.
 * @param {ReturnType<typeof buildSubmitRequest>} prepared
 */
export async function submitViaDouble(prepared) {
  return {
    ok: true,
    mode: 'double',
    externalCallMade: false,
    status: 200,
    request: {
      method: prepared.method,
      path: prepared.path,
      url: prepared.url,
      source: prepared.source,
      body: prepared.body,
      headers: prepared.headers,
    },
    response: {
      links: [
        {
          href: prepared.path,
          method: 'GET',
          rel: 'self',
        },
      ],
      // Explicitly not an HMRC correlation id
      previewReceiptId: `preview-${prepared.source}-${Date.now()}`,
      submissionId: null,
      message:
        'PREVIEW ONLY — not sent to HMRC. Same request shape as a real submit for inspection.',
    },
  };
}

/**
 * Sandbox HTTP submit using fetch.
 * @param {ReturnType<typeof buildSubmitRequest>} prepared
 * @param {HmrcConfig} config
 */
export async function submitViaSandbox(prepared, config) {
  const token = config.accessToken || process.env.HMRC_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'HMRC sandbox submit requires a real access token. Mock/demo tokens are not used for external calls.'
    );
  }
  if (String(token).startsWith('mock-')) {
    throw new Error(
      'Refusing sandbox submit with a mock access token. Connect real HMRC OAuth credentials.'
    );
  }

  const res = await fetch(prepared.url, {
    method: prepared.method,
    headers: prepared.headers,
    body: JSON.stringify(prepared.body),
  });

  let responseBody;
  const text = await res.text();
  try {
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = { raw: text };
  }

  return {
    ok: res.ok,
    mode: 'sandbox',
    externalCallMade: true,
    status: res.status,
    request: {
      method: prepared.method,
      path: prepared.path,
      url: prepared.url,
      source: prepared.source,
      body: prepared.body,
    },
    response: responseBody,
  };
}
