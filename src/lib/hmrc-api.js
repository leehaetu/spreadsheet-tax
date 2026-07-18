/**
 * HMRC MTD ITSA API client — P1 in-year, P2 EOY/BSAS, P3 extras.
 * User-restricted calls need accessToken; FPH attached honestly.
 * Host switches with HMRC_OAUTH_ENV (sandbox | production).
 */

import { buildFraudPreventionHeaders } from './fraud-headers.js';
import { oauthConfig } from './hmrc-oauth.js';
import {
  sanitizeUkPropertyPeriodBody,
  sanitizeForeignPropertyPeriodBody,
  taxYearFromPeriodStart,
} from './hmrc-sandbox.js';

const SANDBOX = 'https://test-api.service.hmrc.gov.uk';
const LIVE = 'https://api.service.hmrc.gov.uk';

export function hmrcApiBase() {
  const mode = oauthConfig().mode;
  if (process.env.HMRC_BASE_URL) return process.env.HMRC_BASE_URL.replace(/\/$/, '');
  return mode === 'production' ? LIVE : SANDBOX;
}

/**
 * @param {{
 *   method?: string,
 *   path: string,
 *   accessToken: string,
 *   accept: string,
 *   body?: object|null,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 *   label?: string,
 * }} opts
 */
export async function hmrcFetch(opts) {
  const method = (opts.method || 'GET').toUpperCase();
  const fph = buildFraudPreventionHeaders(opts.req || null, {
    userId: opts.userId || null,
  });
  /** @type {Record<string, string>} */
  const headers = {
    Accept: opts.accept,
    Authorization: `Bearer ${opts.accessToken}`,
    ...fph,
  };
  if (opts.body != null && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }
  const url = `${hmrcApiBase()}${opts.path}`;
  const res = await fetch(url, {
    method,
    headers,
    body:
      opts.body != null && method !== 'GET' && method !== 'HEAD'
        ? JSON.stringify(opts.body)
        : undefined,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 2500) };
  }
  /** @type {Record<string, string>} */
  const responseHeaders = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });
  return {
    ok: res.ok,
    status: res.status,
    path: opts.path,
    method,
    label: opts.label || opts.path,
    url,
    body,
    requestBody: opts.body ?? null,
    fraudHeaderNames: Object.keys(fph),
    externalCallMade: true,
    mode: oauthConfig().mode,
    responseHeaders,
    correlationId:
      responseHeaders['x-correlationid'] ||
      responseHeaders['x-correlation-id'] ||
      null,
  };
}

function ninoClean(n) {
  return String(n || '').replace(/\s+/g, '').toUpperCase();
}

const SE = () => process.env.HMRC_SE_API_VERSION || '5.0';
const PROP = () => process.env.HMRC_PROPERTY_API_VERSION || '6.0';
const BD = () => process.env.HMRC_BD_API_VERSION || '2.0';
const OBL = () => process.env.HMRC_OBLIGATIONS_API_VERSION || '3.0';
const CALC = () => process.env.HMRC_CALC_API_VERSION || '8.0';
const BSAS = () => process.env.HMRC_BSAS_API_VERSION || '7.0';
const LOSS = () => process.env.HMRC_LOSSES_API_VERSION || '7.0';
const ID = () => process.env.HMRC_INDIVIDUAL_DETAILS_API_VERSION || '2.0';
const BISS = () => process.env.HMRC_BISS_API_VERSION || '3.0';
const ACCOUNTS = () => process.env.HMRC_ACCOUNTS_API_VERSION || '4.0';
const TLA = () => process.env.HMRC_TLA_API_VERSION || '1.0';

// ——— P1 In-year ———

export async function listBusinesses(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/details/${nino}/list`,
    accept: `application/vnd.hmrc.${BD()}+json`,
    label: 'business_details_list',
  });
}

export async function retrieveBusinessDetails(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/details/${nino}/${opts.businessId}`,
    accept: `application/vnd.hmrc.${BD()}+json`,
    label: 'business_details_retrieve',
  });
}

export async function listIncomeExpenditureObligations(opts) {
  const nino = ninoClean(opts.nino);
  const params = new URLSearchParams();
  if (opts.typeOfBusiness) params.set('typeOfBusiness', opts.typeOfBusiness);
  if (opts.businessId) params.set('businessId', opts.businessId);
  if (opts.fromDate) params.set('fromDate', opts.fromDate);
  if (opts.toDate) params.set('toDate', opts.toDate);
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  return hmrcFetch({
    ...opts,
    path: `/obligations/details/${nino}/income-and-expenditure${qs ? `?${qs}` : ''}`,
    accept: `application/vnd.hmrc.${OBL()}+json`,
    label: 'obligations_ie',
  });
}

export async function createSePeriod(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/business/self-employment/${nino}/${opts.businessId}/period`,
    accept: `application/vnd.hmrc.${SE()}+json`,
    body: opts.body,
    label: 'se_period_create',
  });
}

export async function listSePeriods(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear || '2024-25';
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/self-employment/${nino}/${opts.businessId}/period/${taxYear}`,
    accept: `application/vnd.hmrc.${SE()}+json`,
    label: 'se_period_list',
  });
}

export async function retrieveSePeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear || taxYearFromPeriodId(opts.periodId) || '2024-25';
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/self-employment/${nino}/${opts.businessId}/period/${taxYear}/${opts.periodId}`,
    accept: `application/vnd.hmrc.${SE()}+json`,
    label: 'se_period_retrieve',
  });
}

export async function amendSePeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear || taxYearFromPeriodId(opts.periodId) || '2024-25';
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/self-employment/${nino}/${opts.businessId}/period/${taxYear}/${opts.periodId}`,
    accept: `application/vnd.hmrc.${SE()}+json`,
    body: opts.body,
    label: 'se_period_amend',
  });
}

/** Amend UK property period (PUT — same path family as retrieve). */
export async function amendUkPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear || taxYearFromPeriodId(opts.periodId) || '2024-25';
  const body = sanitizeUkPropertyPeriodBody(opts.body, taxYear);
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/property/uk/${nino}/${opts.businessId}/period/${taxYear}/${opts.periodId}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body,
    label: 'uk_property_period_amend',
  });
}

/** Amend foreign property period. */
export async function amendForeignPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear || taxYearFromPeriodId(opts.periodId) || '2024-25';
  const body = sanitizeForeignPropertyPeriodBody(opts.body, taxYear);
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/property/foreign/${nino}/${opts.businessId}/period/${taxYear}/${opts.periodId}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body,
    label: 'foreign_property_period_amend',
  });
}

/** periodId like 2024-04-06_2024-07-05 → 2024-25 */
export function taxYearFromPeriodId(periodId) {
  const m = String(periodId || '').match(/^(\d{4})-\d{2}-\d{2}_/);
  if (!m) return null;
  return taxYearFromPeriodStart(`${m[1]}-04-06`);
}

export async function createUkPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear;
  const body = sanitizeUkPropertyPeriodBody(opts.body, taxYear);
  if (
    !body?.fromDate ||
    !body?.toDate ||
    !(body.ukNonFhlProperty || body.ukOtherProperty || body.ukFhlProperty)
  ) {
    throw new Error(
      'UK property period body must include fromDate, toDate, and a UK property income/expenses object'
    );
  }
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/business/property/uk/${nino}/${opts.businessId}/period/${taxYear}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body,
    label: 'uk_property_period_create',
  });
}

export async function retrieveUkPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/property/uk/${nino}/${opts.businessId}/period/${opts.taxYear}/${opts.periodId}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    label: 'uk_property_period_retrieve',
  });
}

export async function createForeignPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear;
  const body = sanitizeForeignPropertyPeriodBody(opts.body, taxYear);
  if (
    !body?.fromDate ||
    !body?.toDate ||
    !(body.foreignNonFhlProperty || body.foreignProperty || body.foreignFhlEea)
  ) {
    throw new Error(
      'Foreign property period body must include fromDate, toDate, and foreign property income/expenses'
    );
  }
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/business/property/foreign/${nino}/${opts.businessId}/period/${taxYear}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body,
    label: 'foreign_property_period_create',
  });
}

export async function retrieveForeignPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/property/foreign/${nino}/${opts.businessId}/period/${opts.taxYear}/${opts.periodId}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    label: 'foreign_property_period_retrieve',
  });
}

/** Trigger in-year tax calculation */
export async function triggerCalculation(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear;
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/calculations/${nino}/self-assessment/${taxYear}/trigger/${opts.calculationType || 'in-year'}`,
    accept: `application/vnd.hmrc.${CALC()}+json`,
    body: opts.body || {},
    label: 'calculations_trigger',
  });
}

export async function listCalculations(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/calculations/${nino}/self-assessment/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${CALC()}+json`,
    label: 'calculations_list',
  });
}

export async function retrieveCalculation(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/calculations/${nino}/self-assessment/${opts.taxYear}/${opts.calculationId}`,
    accept: `application/vnd.hmrc.${CALC()}+json`,
    label: 'calculations_retrieve',
  });
}

// ——— P2 EOY / BSAS ———

export async function listFinalDeclarationObligations(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/obligations/details/${nino}/crystallisation`,
    accept: `application/vnd.hmrc.${OBL()}+json`,
    label: 'obligations_crystallisation',
  });
}

export async function putSeAnnualSubmission(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/self-employment/${nino}/${opts.businessId}/annual/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${SE()}+json`,
    body: opts.body,
    label: 'se_annual_put',
  });
}

export async function putUkPropertyAnnualSubmission(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/property/uk/${nino}/${opts.businessId}/annual/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body: opts.body,
    label: 'uk_property_annual_put',
  });
}

export async function putForeignPropertyAnnualSubmission(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/property/foreign/${nino}/${opts.businessId}/annual/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body: opts.body,
    label: 'foreign_property_annual_put',
  });
}

export async function triggerBsas(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment/adjustable-summary/${nino}/trigger`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    body: opts.body,
    label: 'bsas_trigger',
  });
}

export async function listBsas(opts) {
  const nino = ninoClean(opts.nino);
  const params = new URLSearchParams();
  if (opts.taxYear) params.set('taxYear', opts.taxYear);
  if (opts.typeOfBusiness) params.set('typeOfBusiness', opts.typeOfBusiness);
  if (opts.businessId) params.set('businessId', opts.businessId);
  const qs = params.toString();
  return hmrcFetch({
    ...opts,
    path: `/individuals/self-assessment/adjustable-summary/${nino}${qs ? `?${qs}` : ''}`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    label: 'bsas_list',
  });
}

export async function retrieveBsasSelfEmployment(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/self-assessment/adjustable-summary/${nino}/self-employment/${opts.calculationId}`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    label: 'bsas_retrieve_se',
  });
}

export async function retrieveBsasUkProperty(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/self-assessment/adjustable-summary/${nino}/uk-property/${opts.calculationId}`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    label: 'bsas_retrieve_uk',
  });
}

export async function retrieveBsasForeignProperty(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/self-assessment/adjustable-summary/${nino}/foreign-property/${opts.calculationId}`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    label: 'bsas_retrieve_foreign',
  });
}

export async function submitBsasSeAdjustments(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment/adjustable-summary/${nino}/self-employment/${opts.calculationId}/adjust`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    body: opts.body,
    label: 'bsas_adjust_se',
  });
}

export async function submitBsasUkAdjustments(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment/adjustable-summary/${nino}/uk-property/${opts.calculationId}/adjust`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    body: opts.body,
    label: 'bsas_adjust_uk',
  });
}

export async function submitBsasForeignAdjustments(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment/adjustable-summary/${nino}/foreign-property/${opts.calculationId}/adjust`,
    accept: `application/vnd.hmrc.${BSAS()}+json`,
    body: opts.body,
    label: 'bsas_adjust_foreign',
  });
}

/** Brought-forward loss create (Individual Losses) */
export async function createBroughtForwardLoss(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/losses/${nino}/brought-forward-losses`,
    accept: `application/vnd.hmrc.${LOSS()}+json`,
    body: opts.body,
    label: 'losses_bf_create',
  });
}

export async function listBroughtForwardLosses(opts) {
  const nino = ninoClean(opts.nino);
  const params = new URLSearchParams();
  if (opts.taxYearBroughtForwardFrom) {
    params.set('taxYearBroughtForwardFrom', opts.taxYearBroughtForwardFrom);
  }
  if (opts.businessId) params.set('businessId', opts.businessId);
  if (opts.typeOfLoss) params.set('typeOfLoss', opts.typeOfLoss);
  const qs = params.toString();
  return hmrcFetch({
    ...opts,
    path: `/individuals/losses/${nino}/brought-forward-losses${qs ? `?${qs}` : ''}`,
    accept: `application/vnd.hmrc.${LOSS()}+json`,
    label: 'losses_bf_list',
  });
}

export async function createTaxLiabilityAdjustment(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/tax-liability-adjustments/${nino}/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${TLA()}+json`,
    body: opts.body,
    label: 'tla_create',
  });
}

export async function retrievePeriodsOfAccount(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    path: `/individuals/business/details/${nino}/${opts.businessId}/${opts.taxYear}/periods-of-account`,
    accept: `application/vnd.hmrc.${BD()}+json`,
    label: 'bd_periods_of_account',
  });
}

export async function createOrUpdatePeriodsOfAccount(opts) {
  const nino = ninoClean(opts.nino);
  return hmrcFetch({
    ...opts,
    method: 'PUT',
    path: `/individuals/business/details/${nino}/${opts.businessId}/${opts.taxYear}/periods-of-account`,
    accept: `application/vnd.hmrc.${BD()}+json`,
    body: opts.body,
    label: 'bd_periods_of_account_put',
  });
}

// ——— P3 Extras ———

export async function retrieveItsaStatus(opts) {
  const nino = ninoClean(opts.nino);
  // Self Assessment Individual Details — ITSA status
  return hmrcFetch({
    ...opts,
    path: `/individuals/person/itsa-status/${nino}/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${ID()}+json`,
    label: 'individual_details_itsa_status',
  });
}

export async function retrieveBiss(opts) {
  const nino = ninoClean(opts.nino);
  const type = opts.typeOfBusiness || 'self-employment';
  return hmrcFetch({
    ...opts,
    path: `/individuals/self-assessment/income-summary/${nino}/${type}/${opts.taxYear}/${opts.businessId}`,
    accept: `application/vnd.hmrc.${BISS()}+json`,
    label: 'biss_retrieve',
  });
}

export async function retrieveBalanceAndTransactions(opts) {
  const nino = ninoClean(opts.nino);
  const params = new URLSearchParams();
  if (opts.docNumber) params.set('docNumber', opts.docNumber);
  if (opts.fromDate) params.set('fromDate', opts.fromDate);
  if (opts.toDate) params.set('toDate', opts.toDate);
  // HMRC RULE_INCONSISTENT_QUERY_PARAMS without onlyOpenItems or a date range
  const onlyOpen =
    opts.onlyOpenItems != null ? opts.onlyOpenItems : opts.fromDate ? undefined : true;
  if (onlyOpen != null) params.set('onlyOpenItems', String(onlyOpen));
  if (opts.includeLocks != null) params.set('includeLocks', String(opts.includeLocks));
  if (opts.calculateAccruedInterest != null) {
    params.set('calculateAccruedInterest', String(opts.calculateAccruedInterest));
  }
  if (opts.removePOA != null) params.set('removePOA', String(opts.removePOA));
  if (opts.customerPaymentInformation != null) {
    params.set('customerPaymentInformation', String(opts.customerPaymentInformation));
  }
  if (opts.includeEstimatedCharges != null) {
    params.set('includeEstimatedCharges', String(opts.includeEstimatedCharges));
  }
  const qs = params.toString();
  return hmrcFetch({
    ...opts,
    path: `/accounts/self-assessment/${nino}/balance-and-transactions${qs ? `?${qs}` : ''}`,
    accept: `application/vnd.hmrc.${ACCOUNTS()}+json`,
    label: 'accounts_balance_and_transactions',
  });
}

/**
 * True when annual body would be rejected as empty by HMRC.
 * @param {object|null|undefined} body
 */
export function isEmptySeAnnualBody(body) {
  if (!body || typeof body !== 'object') return true;
  const all = body.allowances && typeof body.allowances === 'object' ? body.allowances : {};
  const adj = body.adjustments && typeof body.adjustments === 'object' ? body.adjustments : {};
  return Object.keys(all).length === 0 && Object.keys(adj).length === 0;
}

/**
 * @param {object|null|undefined} body
 */
export function resolveSeAnnualBody(body) {
  return isEmptySeAnnualBody(body) ? defaultSeAnnualBody() : body;
}

/**
 * Resolve period body from draft payloads for a source.
 * @param {object} draft
 * @param {string} source
 */
export function periodBodyFromDraft(draft, source) {
  const p = draft?.payloads || draft;
  if (!p) return null;
  if (source === 'self_employment' || source === 'se') return p.selfEmployment || null;
  if (source === 'uk_property' || source === 'uk') return p.ukProperty || null;
  if (source === 'foreign_property' || source === 'foreign') return p.foreignProperty || null;
  return null;
}

/**
 * Annual submission body from draft/EOY figures when present; else defaults.
 * @param {object|null} draftOrPayloads
 * @param {'se'|'uk'|'foreign'} source
 */
export function annualBodyFromDraft(draftOrPayloads, source) {
  const p = draftOrPayloads?.payloads || draftOrPayloads || {};
  const annual = p.annual || p.yearEnd || p.eoy || {};
  if (source === 'se') {
    if (annual.selfEmployment) return resolveSeAnnualBody(annual.selfEmployment);
    if (p.seAnnual) return resolveSeAnnualBody(p.seAnnual);
    return defaultSeAnnualBody();
  }
  if (source === 'uk') {
    if (annual.ukProperty) return annual.ukProperty;
    if (p.ukAnnual) return p.ukAnnual;
    return {
      ukOtherProperty: {
        adjustments: {
          balancingCharge: 0,
          privateUseAdjustment: 0,
          businessPremisesRenovationAllowanceBalancingCharges: 0,
        },
        allowances: {
          annualInvestmentAllowance: 0,
          otherCapitalAllowance: 0,
          zeroEmissionsCarAllowance: 0,
        },
      },
    };
  }
  if (source === 'foreign') {
    if (annual.foreignProperty) return annual.foreignProperty;
    if (p.fpAnnual) return p.fpAnnual;
    return {
      foreignProperty: [
        {
          countryCode: 'ESP',
          adjustments: { privateUseAdjustment: 0, balancingCharge: 0 },
          allowances: { annualInvestmentAllowance: 0, otherCapitalAllowance: 0 },
        },
      ],
    };
  }
  return null;
}

export { taxYearFromPeriodStart };

/**
 * Create sandbox test business (SA Test Support MTD) — user-restricted.
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   typeOfBusiness: 'self-employment'|'uk-property'|'foreign-property',
 *   body?: object,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 */
export async function createTestBusiness(opts) {
  const nino = ninoClean(opts.nino);
  const type = opts.typeOfBusiness;
  const defaultBodies = {
    'uk-property': {
      typeOfBusiness: 'uk-property',
      firstAccountingPeriodStartDate: '2024-04-06',
      firstAccountingPeriodEndDate: '2025-04-05',
      quarterlyTypeChoice: {
        quarterlyPeriodType: 'standard',
        taxYearOfChoice: '2024-25',
      },
      accountingType: 'CASH',
      commencementDate: '2020-04-06',
    },
    'foreign-property': {
      typeOfBusiness: 'foreign-property',
      firstAccountingPeriodStartDate: '2024-04-06',
      firstAccountingPeriodEndDate: '2025-04-05',
      quarterlyTypeChoice: {
        quarterlyPeriodType: 'standard',
        taxYearOfChoice: '2024-25',
      },
      accountingType: 'CASH',
      commencementDate: '2020-04-06',
    },
    'self-employment': {
      typeOfBusiness: 'self-employment',
      tradingName: 'Spreadsheet Tax Test Trade',
      firstAccountingPeriodStartDate: '2024-04-06',
      firstAccountingPeriodEndDate: '2025-04-05',
      quarterlyTypeChoice: {
        quarterlyPeriodType: 'standard',
        taxYearOfChoice: '2024-25',
      },
      accountingType: 'CASH',
      commencementDate: '2020-04-06',
      businessAddressLineOne: '1 Test Street',
      businessAddressPostcode: 'SW1A 1AA',
      businessAddressCountryCode: 'GB',
    },
  };
  const body = opts.body || defaultBodies[type];
  if (!body) {
    throw new Error(`Unsupported typeOfBusiness: ${type}`);
  }
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment-test-support/business/${nino}`,
    accept: 'application/vnd.hmrc.1.0+json',
    body,
    label: 'test_support_create_business',
  });
}

/** Minimal non-empty SE annual body for sandbox evidence */
export function defaultSeAnnualBody() {
  return {
    allowances: {
      annualInvestmentAllowance: 1.0,
      otherCapitalAllowance: 0,
    },
    adjustments: {
      includedNonTaxableProfits: 0,
      basisAdjustment: 0,
    },
  };
}

/**
 * Self Assessment Assist (MTD) 1.0 — generate HMRC Assist report for a calculation.
 * POST /individuals/self-assessment/assist/reports/{nino}/{taxYear}/{calculationId}
 * OAuth scope: read:self-assessment-assist
 * @param {{ nino: string, taxYear: string, calculationId: string, accessToken: string, req?: unknown, userId?: string|null }} opts
 */
export async function generateSaAssistReport(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = String(opts.taxYear || '').trim();
  const calculationId = String(opts.calculationId || '').trim();
  if (!nino || !taxYear || !calculationId) {
    throw new Error('nino, taxYear and calculationId required for SA Assist report');
  }
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment/assist/reports/${encodeURIComponent(nino)}/${encodeURIComponent(taxYear)}/${encodeURIComponent(calculationId)}`,
    accept: 'application/vnd.hmrc.1.0+json',
    body: null,
    label: 'sa_assist_generate_report',
  });
}

/**
 * Acknowledge that the Assist report was shown to the customer.
 * POST /individuals/self-assessment/assist/reports/acknowledge/{nino}/{reportId}/{correlationId}
 * OAuth scope: write:self-assessment-assist
 * @param {{ nino: string, reportId: string, correlationId: string, accessToken: string, req?: unknown, userId?: string|null }} opts
 */
export async function acknowledgeSaAssistReport(opts) {
  const nino = ninoClean(opts.nino);
  const reportId = String(opts.reportId || '').trim();
  const correlationId = String(opts.correlationId || '').trim();
  if (!nino || !reportId || !correlationId) {
    throw new Error('nino, reportId and correlationId required to acknowledge SA Assist report');
  }
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/self-assessment/assist/reports/acknowledge/${encodeURIComponent(nino)}/${encodeURIComponent(reportId)}/${encodeURIComponent(correlationId)}`,
    accept: 'application/vnd.hmrc.1.0+json',
    body: null,
    label: 'sa_assist_acknowledge_report',
  });
}

/** Capability matrix for integrity / status */
export function mtdCapabilityMatrix() {
  return {
    phase: 'P1-P2-P3',
    goal: 'HMRC Recognised',
    eops: false,
    productionSwitch: 'env-only (HMRC_OAUTH_ENV + credentials + base URL)',
    inYear: {
      businessDetails: true,
      obligationsIe: true,
      sePeriodCreateRetrieveAmend: true,
      ukPropertyPeriod: true,
      foreignPropertyPeriod: true,
      calculationsTriggerListRetrieve: true,
      createTestBusinessSandbox: true,
      multiSourceDraftSubmit: true,
    },
    endOfYear: {
      crystallisationObligations: true,
      seAnnual: true,
      ukPropertyAnnual: true,
      foreignPropertyAnnual: true,
      bsasTriggerListRetrieveAdjust: true,
      broughtForwardLosses: true,
      taxLiabilityAdjustments: true,
      periodsOfAccount: true,
      saAssistReport: true,
    },
    extras: {
      itsaStatus: true,
      biss: true,
      accountsBalanceAndTransactions: true,
      saAssist: true,
      hubSubscribedAsOf: '2026-07-18',
      hubApis: [
        'Business Details (MTD) 2.0',
        'Obligations (MTD) 3.0',
        'Self Employment Business (MTD) 5.0',
        'Property Business (MTD) 6.0',
        'Individual Calculations (MTD) 8.0',
        'Business Source Adjustable Summary (MTD) 7.0',
        'Business Income Source Summary (MTD) 3.0',
        'Self Assessment Individual Details (MTD) 2.0',
        'Self Assessment Accounts (MTD) 4.0',
        'Self Assessment Assist (MTD) 1.0',
        'Test Fraud Prevention Headers 1.0',
        'Self Assessment Test Support (MTD) 1.0',
        'Create Test User 1.0',
        'Hello World 1.0',
      ],
      note: 'If Hub not subscribed, HMRC returns 403 RESOURCE_FORBIDDEN — surfaced honestly, never faked',
    },
  };
}
