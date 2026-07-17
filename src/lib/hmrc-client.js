/**
 * HMRC MTD ITSA client — sandbox HTTP implementation + in-process test double.
 * Both share the same request construction so unit tests drive real shapes.
 */

const DEFAULT_SANDBOX_BASE = 'https://test-api.service.hmrc.gov.uk';

/**
 * @typedef {object} HmrcConfig
 * @property {'sandbox' | 'double'} mode
 * @property {string} [baseUrl]
 * @property {string} [clientId]
 * @property {string} [clientSecret]
 * @property {string} [accessToken]
 * @property {string} [nino]
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
  const nino = req.nino || config.nino || 'AA123456A';
  const { businessId, taxYear, body, source, periodId } = req;

  let path;
  let method = 'POST';

  if (source === 'self_employment') {
    // Self-Employment Business (MTD) create period summary
    path = `/individuals/business/self-employment/${nino}/${businessId}/period`;
    if (periodId) {
      method = 'PUT';
      path = `/individuals/business/self-employment/${nino}/${businessId}/period/${periodId}`;
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

  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/vnd.hmrc.1.0+json',
    'Content-Type': 'application/json',
  };
  if (config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`;
  }

  return {
    method,
    url: `${base}${path}`,
    path,
    headers,
    body,
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
      const nino = ids.nino || payloads.meta?.nino || config.nino || 'AA123456A';
      const taxYear = ids.taxYear || payloads.meta?.taxYear || '2024-25';
      const results = [];

      if (payloads.selfEmployment) {
        results.push(
          await this.submitPeriodSummary({
            source: 'self_employment',
            nino,
            businessId: ids.businessIdSe || payloads.meta?.businessId || 'XAIS12345678901',
            taxYear,
            body: payloads.selfEmployment,
          })
        );
      }
      if (payloads.ukProperty) {
        results.push(
          await this.submitPeriodSummary({
            source: 'uk_property',
            nino,
            businessId: ids.businessIdUk || payloads.meta?.businessId || 'XPIS12345678901',
            taxYear,
            body: payloads.ukProperty,
          })
        );
      }
      if (payloads.foreignProperty) {
        results.push(
          await this.submitPeriodSummary({
            source: 'foreign_property',
            nino,
            businessId:
              ids.businessIdForeign || payloads.meta?.businessId || 'XFIS12345678901',
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
  const clientId = overrides.clientId ?? process.env.HMRC_CLIENT_ID;
  let mode = overrides.mode;
  if (!mode) {
    if (envMode === 'sandbox' || envMode === 'double') mode = envMode;
    else mode = clientId ? 'sandbox' : 'double';
  }
  return {
    mode,
    baseUrl: overrides.baseUrl ?? process.env.HMRC_BASE_URL ?? DEFAULT_SANDBOX_BASE,
    clientId,
    clientSecret: overrides.clientSecret ?? process.env.HMRC_CLIENT_SECRET,
    accessToken: overrides.accessToken ?? process.env.HMRC_ACCESS_TOKEN,
    nino: overrides.nino ?? process.env.HMRC_NINO,
  };
}

/**
 * In-process test double: accepts same request shape, returns success envelope.
 * @param {ReturnType<typeof buildSubmitRequest>} prepared
 */
export async function submitViaDouble(prepared) {
  return {
    ok: true,
    mode: 'double',
    status: 200,
    request: {
      method: prepared.method,
      path: prepared.path,
      url: prepared.url,
      source: prepared.source,
      body: prepared.body,
    },
    response: {
      links: [
        {
          href: prepared.path,
          method: 'GET',
          rel: 'self',
        },
      ],
      submissionId: `double-${prepared.source}-${Date.now()}`,
      message: 'Accepted by HMRC test double (no external call)',
    },
  };
}

/**
 * Sandbox HTTP submit using fetch.
 * @param {ReturnType<typeof buildSubmitRequest>} prepared
 * @param {HmrcConfig} config
 */
export async function submitViaSandbox(prepared, config) {
  if (!config.accessToken && !process.env.HMRC_ACCESS_TOKEN) {
    // Fall back to double if sandbox not fully configured
    const fallback = await submitViaDouble(prepared);
    return {
      ...fallback,
      mode: 'double',
      warning:
        'HMRC sandbox selected but no access token; used test double for this request',
    };
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
