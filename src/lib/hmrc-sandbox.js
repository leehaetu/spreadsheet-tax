/**
 * HMRC sandbox helpers: Create Test User, Hello checks, fraud-header probe.
 * Application-restricted (client credentials) only — no live tax filing.
 */

import { oauthConfig, getApplicationAccessToken } from './hmrc-oauth.js';
import { buildFraudPreventionHeaders } from './fraud-headers.js';

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
export async function validateFraudPreventionHeaders(req, opts = {}) {
  const tok = await getApplicationAccessToken();
  if (!tok.ok) {
    return { ok: false, error: tok.error };
  }
  const headers = buildFraudPreventionHeaders(req, {
    userId: opts.userId || null,
  });
  // Primary path used by HMRC TXM validator (GET feedback after request, or validate)
  const paths = [
    {
      method: 'GET',
      url: `${SANDBOX}/test/fraud-prevention-headers/validation-feedback`,
    },
    {
      method: 'GET',
      url: `${SANDBOX}/test/fraud-prevention-headers/vat/validation-feedback`,
    },
  ];
  // First send a request with headers attached so validator has a request to inspect
  await fetch(`${SANDBOX}/hello/application`, {
    headers: {
      Accept: 'application/vnd.hmrc.1.0+json',
      Authorization: `Bearer ${tok.accessToken}`,
      ...headers,
    },
  }).catch(() => null);

  const attempts = [];
  for (const p of paths) {
    const res = await fetch(p.url, {
      method: p.method,
      headers: {
        Accept: 'application/vnd.hmrc.1.0+json',
        Authorization: `Bearer ${tok.accessToken}`,
        ...headers,
      },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 800) };
    }
    attempts.push({ url: p.url, status: res.status, ok: res.ok, body });
    if (res.ok) {
      return {
        ok: true,
        headersSent: Object.keys(headers),
        headers,
        feedback: body,
        attempts,
      };
    }
  }
  return {
    ok: false,
    headersSent: Object.keys(headers),
    headers,
    attempts,
    note: 'Validator feedback endpoints returned non-OK; headers above are still attached to all outbound HMRC builds. Re-check after sending a user-restricted MTD call.',
  };
}

/**
 * Snapshot of sandbox readiness for operators.
 */
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
