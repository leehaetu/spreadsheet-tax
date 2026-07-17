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

/** periodId like 2024-04-06_2024-07-05 → 2024-25 */
export function taxYearFromPeriodId(periodId) {
  const m = String(periodId || '').match(/^(\d{4})-\d{2}-\d{2}_/);
  if (!m) return null;
  return taxYearFromPeriodStart(`${m[1]}-04-06`);
}

export async function createUkPropertyPeriod(opts) {
  const nino = ninoClean(opts.nino);
  const taxYear = opts.taxYear;
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/business/property/uk/${nino}/${opts.businessId}/period/${taxYear}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body: sanitizeUkPropertyPeriodBody(opts.body),
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
  return hmrcFetch({
    ...opts,
    method: 'POST',
    path: `/individuals/business/property/foreign/${nino}/${opts.businessId}/period/${opts.taxYear}`,
    accept: `application/vnd.hmrc.${PROP()}+json`,
    body: sanitizeForeignPropertyPeriodBody(opts.body),
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
  if (opts.onlyOpenItems != null) params.set('onlyOpenItems', String(opts.onlyOpenItems));
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
 * Resolve period body from draft payloads for a source.
 * @param {object} draft
 * @param {string} source
 */
export function periodBodyFromDraft(draft, source) {
  const p = draft?.payloads;
  if (!p) return null;
  if (source === 'self_employment' || source === 'se') return p.selfEmployment || null;
  if (source === 'uk_property' || source === 'uk') return p.ukProperty || null;
  if (source === 'foreign_property' || source === 'foreign') return p.foreignProperty || null;
  return null;
}

export { taxYearFromPeriodStart };

/** Capability matrix for integrity / status */
export function mtdCapabilityMatrix() {
  return {
    phase: 'P1-P2-P3',
    goal: 'HMRC Recognised',
    eops: false,
    inYear: {
      businessDetails: true,
      obligationsIe: true,
      sePeriodCreateRetrieveAmend: true,
      ukPropertyPeriod: true,
      foreignPropertyPeriod: true,
      calculationsTriggerListRetrieve: true,
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
    },
    extras: {
      itsaStatus: true,
      biss: true,
      accountsBalanceAndTransactions: true,
    },
  };
}
