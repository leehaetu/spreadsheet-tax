/**
 * HMRC sandbox helpers: Create Test User, Hello checks, fraud-header probe.
 * Application-restricted (client credentials) only — no live tax filing.
 */

import { oauthConfig, getApplicationAccessToken } from './hmrc-oauth.js';
import {
  buildFraudPreventionHeaders,
  buildFraudPreventionHeadersDetailed,
} from './fraud-headers.js';

const SANDBOX = 'https://test-api.service.hmrc.gov.uk';

/**
 * Create an individual sandbox test user enrolled for MTD Income Tax.
 * @param {{ serviceNames?: string[] }} [opts]
 */
export async function createSandboxIndividual(opts = {}) {
  const tok = await getApplicationAccessToken();
  if (!tok.ok) {
    return { ok: false, error: tok.error };
  }
  const serviceNames = opts.serviceNames || [
    'mtd-income-tax',
    'self-assessment',
    'national-insurance',
  ];
  const res = await fetch(`${SANDBOX}/create-test-user/individuals`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tok.accessToken}`,
      Accept: 'application/vnd.hmrc.1.0+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ serviceNames }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json.message || json.code || JSON.stringify(json).slice(0, 400),
    };
  }
  return {
    ok: true,
    user: {
      userId: json.userId,
      password: json.password,
      userFullName: json.userFullName,
      emailAddress: json.emailAddress,
      nino: json.nino,
      saUtr: json.saUtr,
      mtdItId: json.mtdItId,
      individualDetails: json.individualDetails,
    },
    note: 'Use userId + password at HMRC OAuth sign-in during Connect HMRC. Store password securely; it is only shown once by HMRC.',
  };
}

/**
 * POST headers to HMRC Test Fraud Prevention Headers feedback endpoint (sandbox).
 * Endpoint path follows current validator API patterns; failures return raw status for diagnosis.
 * @param {import('express').Request | null} req
 * @param {{ userId?: string|null }} [opts]
 */
/**
 * Validate headers via official GET /test/fraud-prevention-headers/validate
 * @param {import('express').Request | null} req
 * @param {{ userId?: string|null }} [opts]
 */
export async function validateFraudPreventionHeaders(req, opts = {}) {
  const tok = await getApplicationAccessToken();
  if (!tok.ok) {
    return { ok: false, error: tok.error };
  }
  const detailed = buildFraudPreventionHeadersDetailed(req, {
    userId: opts.userId || null,
  });
  const headers = detailed.headers;

  const res = await fetch(
    `${SANDBOX}/test/fraud-prevention-headers/validate`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.hmrc.1.0+json',
        Authorization: `Bearer ${tok.accessToken}`,
        ...headers,
      },
    }
  );
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 1200) };
  }

  // Optional per-API feedback after MTD calls
  const feedbackRes = await fetch(
    `${SANDBOX}/test/fraud-prevention-headers/self-employment-business-mtd/validation-feedback?connectionMethod=WEB_APP_VIA_SERVER`,
    {
      headers: {
        Accept: 'application/vnd.hmrc.1.0+json',
        Authorization: `Bearer ${tok.accessToken}`,
      },
    }
  );
  const feedbackText = await feedbackRes.text();
  let feedbackBody;
  try {
    feedbackBody = JSON.parse(feedbackText);
  } catch {
    feedbackBody = { raw: feedbackText.slice(0, 800) };
  }

  const code = body?.code;
  const valid = res.ok && code === 'VALID_HEADERS';
  return {
    ok: valid,
    httpStatus: res.status,
    validationCode: code || null,
    message: body?.message || null,
    specVersion: body?.specVersion || null,
    errors: body?.errors || [],
    warnings: body?.warnings || [],
    headersSent: headers,
    headerNames: Object.keys(headers),
    omittedHonestly: detailed.omitted,
    perApiFeedback: feedbackBody,
    note:
      code === 'VALID_HEADERS'
        ? 'HMRC Test Fraud Prevention Headers API returned VALID_HEADERS.'
        : 'Headers are only values with real sources. Missing fields are omitted (not invented). See omittedHonestly and HMRC missing-header guidance.',
  };
}

/**
 * List businesses for an individual (user-restricted).
 * @param {{ accessToken: string, nino: string, req?: import('express').Request|null, userId?: string|null }} opts
 */
export async function listBusinessDetails(opts) {
  const nino = String(opts.nino || '').replace(/\s+/g, '').toUpperCase();
  const fph = buildFraudPreventionHeaders(opts.req || null, {
    userId: opts.userId || null,
  });
  const res = await fetch(
    `${SANDBOX}/individuals/business/details/${nino}/list`,
    {
      headers: {
        Accept: 'application/vnd.hmrc.2.0+json',
        Authorization: `Bearer ${opts.accessToken}`,
        ...fph,
      },
    }
  );
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 1500) };
  }
  return {
    ok: res.ok,
    status: res.status,
    body,
    headersSent: Object.keys(fph),
  };
}

/**
 * Retrieve Income Tax (Self Assessment) income and expenditure obligations.
 * Obligations (MTD) — required for in-year product production access.
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   typeOfBusiness?: string,
 *   businessId?: string,
 *   fromDate?: string,
 *   toDate?: string,
 *   status?: string,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 */
export async function listIncomeExpenditureObligations(opts) {
  const nino = String(opts.nino || '').replace(/\s+/g, '').toUpperCase();
  const fph = buildFraudPreventionHeaders(opts.req || null, {
    userId: opts.userId || null,
  });
  const params = new URLSearchParams();
  if (opts.typeOfBusiness) params.set('typeOfBusiness', opts.typeOfBusiness);
  if (opts.businessId) params.set('businessId', opts.businessId);
  if (opts.fromDate) params.set('fromDate', opts.fromDate);
  if (opts.toDate) params.set('toDate', opts.toDate);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  const path = `/obligations/details/${nino}/income-and-expenditure${qs ? `?${qs}` : ''}`;
  const acceptVersion = process.env.HMRC_OBLIGATIONS_API_VERSION || '3.0';
  const res = await fetch(`${SANDBOX}${path}`, {
    headers: {
      Accept: `application/vnd.hmrc.${acceptVersion}+json`,
      Authorization: `Bearer ${opts.accessToken}`,
      ...fph,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 1500) };
  }
  return {
    ok: res.ok,
    status: res.status,
    path,
    body,
    headersSent: Object.keys(fph),
  };
}

/**
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   businessId: string,
 *   body: object,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 * @param {{ path: string, acceptVersion: string, source: string }} route
 */
async function postSandboxPeriod(opts, route) {
  const nino = String(opts.nino || '').replace(/\s+/g, '').toUpperCase();
  const businessId = opts.businessId;
  const fph = buildFraudPreventionHeaders(opts.req || null, {
    userId: opts.userId || null,
  });
  const url = `${SANDBOX}${route.path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: `application/vnd.hmrc.${route.acceptVersion}+json`,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`,
      ...fph,
    },
    body: JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 2000) };
  }
  return {
    ok: res.ok,
    status: res.status,
    source: route.source,
    url,
    path: route.path,
    requestBody: opts.body,
    response: body,
    fraudHeadersSent: fph,
    externalCallMade: true,
    mode: 'sandbox',
  };
}

/**
 * Drop preview-only keys so HMRC Property API does not reject unknown fields.
 * @param {object} body
 */
/**
 * Property Business MTD 6.0:
 * - tax years ≤ 2023-24: ukOtherProperty / foreignProperty (def1)
 * - tax year 2024-25: ukNonFhlProperty / foreignNonFhlProperty (def2)
 * @param {string} [taxYear]
 */
export function propertyPeriodFieldStyle(taxYear) {
  const y = String(taxYear || '');
  // 2024-25 and later use def2 names until cumulative endpoints take over 2025-26+
  if (y >= '2024-25') return 'def2';
  return 'def1';
}

/**
 * @param {object} body
 * @param {string} [taxYear]
 */
export function sanitizeUkPropertyPeriodBody(body, taxYear) {
  if (!body || typeof body !== 'object') return body;
  const fromDate = body.fromDate || body.periodDates?.periodStartDate;
  const toDate = body.toDate || body.periodDates?.periodEndDate;
  const nonFhl =
    body.ukNonFhlProperty || body.ukOtherProperty || null;
  const fhl = body.ukFhlProperty || null;
  const style = propertyPeriodFieldStyle(
    taxYear || taxYearFromPeriodStart(fromDate)
  );
  /** @type {Record<string, unknown>} */
  const out = { fromDate, toDate };
  if (style === 'def2') {
    if (nonFhl) out.ukNonFhlProperty = nonFhl;
    if (fhl) out.ukFhlProperty = fhl;
  } else {
    if (nonFhl) out.ukOtherProperty = nonFhl;
    if (fhl) out.ukFhlProperty = fhl;
  }
  return out;
}

/**
 * @param {object} body
 * @param {string} [taxYear]
 */
export function sanitizeForeignPropertyPeriodBody(body, taxYear) {
  if (!body || typeof body !== 'object') return body;
  const fromDate = body.fromDate || body.periodDates?.periodStartDate;
  const toDate = body.toDate || body.periodDates?.periodEndDate;
  let nonFhl = body.foreignNonFhlProperty || body.foreignProperty || null;
  const fhl = body.foreignFhlEea || null;
  const style = propertyPeriodFieldStyle(
    taxYear || taxYearFromPeriodStart(fromDate)
  );
  // def2 expects foreignTaxCreditRelief boolean on each country income when present
  if (style === 'def2' && Array.isArray(nonFhl)) {
    nonFhl = nonFhl.map((entry) => {
      const e = { ...entry };
      if (e.income && typeof e.income === 'object') {
        e.income = {
          foreignTaxCreditRelief: false,
          ...e.income,
        };
      }
      return e;
    });
  }
  /** @type {Record<string, unknown>} */
  const out = { fromDate, toDate };
  if (style === 'def2') {
    if (nonFhl) out.foreignNonFhlProperty = nonFhl;
    if (fhl) out.foreignFhlEea = fhl;
  } else {
    if (nonFhl) out.foreignProperty = nonFhl;
    if (fhl) out.foreignFhlEea = fhl;
  }
  return out;
}

/**
 * Tax year from period start (UK tax year starting 6 April).
 * @param {string} [periodStartDate]
 * @param {string} [fallback]
 */
export function taxYearFromPeriodStart(periodStartDate, fallback = '2024-25') {
  if (!periodStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(periodStartDate)) {
    return fallback;
  }
  const y = Number(periodStartDate.slice(0, 4));
  const md = periodStartDate.slice(5);
  // On/after 6 April → tax year y-(y+1); before → (y-1)-y
  if (md >= '04-06') {
    return `${y}-${String(y + 1).slice(2)}`;
  }
  return `${y - 1}-${String(y).slice(2)}`;
}

/**
 * Submit SE period summary to sandbox (user-restricted).
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   businessId: string,
 *   body: object,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 */
export async function submitSelfEmploymentPeriodSandbox(opts) {
  const nino = String(opts.nino || '').replace(/\s+/g, '').toUpperCase();
  const businessId = opts.businessId;
  const seVersion = process.env.HMRC_SE_API_VERSION || '5.0';
  return postSandboxPeriod(
    { ...opts, body: opts.body },
    {
      source: 'self_employment',
      acceptVersion: seVersion,
      path: `/individuals/business/self-employment/${nino}/${businessId}/period`,
    }
  );
}

/**
 * Submit UK property period summary to sandbox (Property Business MTD 6.0).
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   businessId: string,
 *   taxYear: string,
 *   body: object,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 */
export async function submitUkPropertyPeriodSandbox(opts) {
  const nino = String(opts.nino || '').replace(/\s+/g, '').toUpperCase();
  const businessId = opts.businessId;
  const taxYear = opts.taxYear;
  if (!taxYear) {
    throw new Error('taxYear required for UK property period submit');
  }
  const propVersion = process.env.HMRC_PROPERTY_API_VERSION || '6.0';
  const body = sanitizeUkPropertyPeriodBody(opts.body);
  return postSandboxPeriod(
    { ...opts, body },
    {
      source: 'uk_property',
      acceptVersion: propVersion,
      path: `/individuals/business/property/uk/${nino}/${businessId}/period/${taxYear}`,
    }
  );
}

/**
 * Submit foreign property period summary to sandbox (Property Business MTD 6.0).
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   businessId: string,
 *   taxYear: string,
 *   body: object,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 */
export async function submitForeignPropertyPeriodSandbox(opts) {
  const nino = String(opts.nino || '').replace(/\s+/g, '').toUpperCase();
  const businessId = opts.businessId;
  const taxYear = opts.taxYear;
  if (!taxYear) {
    throw new Error('taxYear required for foreign property period submit');
  }
  const propVersion = process.env.HMRC_PROPERTY_API_VERSION || '6.0';
  const body = sanitizeForeignPropertyPeriodBody(opts.body);
  return postSandboxPeriod(
    { ...opts, body },
    {
      source: 'foreign_property',
      acceptVersion: propVersion,
      path: `/individuals/business/property/foreign/${nino}/${businessId}/period/${taxYear}`,
    }
  );
}

/**
 * Snapshot of sandbox readiness for operators.
 */
/**
 * Build path for obligations list (pure helper for unit tests).
 * @param {string} nino
 * @param {Record<string, string|undefined>} [query]
 */
export function buildObligationsPath(nino, query = {}) {
  const clean = String(nino || '').replace(/\s+/g, '').toUpperCase();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return `/obligations/details/${clean}/income-and-expenditure${qs ? `?${qs}` : ''}`;
}

export async function sandboxReadiness() {
  const cfg = oauthConfig();
  const tok = await getApplicationAccessToken();
  return {
    environment: cfg.mode,
    mock: cfg.mock,
    hasCredentials: Boolean(cfg.clientId && cfg.clientSecret),
    redirectUri: cfg.redirectUri,
    applicationToken: tok.ok,
    applicationTokenError: tok.ok ? null : tok.error,
    subscribedApisDocumented: [
      'Self Employment Business (MTD) 5.0',
      'Property Business (MTD) 6.0',
      'Business Details (MTD) 2.0',
      'Obligations (MTD) 3.0',
      'Test Fraud Prevention Headers 1.0',
      'Self Assessment Test Support (MTD) 1.0',
      'Create Test User 1.0',
      'Hello World 1.0',
      'BISS 3.0 / BSAS 7.0 / Individual Calculations 8.0 (optional later)',
    ],
  };
}
