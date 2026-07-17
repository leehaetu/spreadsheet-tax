/** Validation for spreadsheet imports and submission identifiers. */
import {
  SE_INCOME_FIELDS, SE_EXPENSE_FIELDS, SE_ADDITIONS_FIELDS,
  UK_PROPERTY_INCOME_FIELDS, UK_PROPERTY_EXPENSE_FIELDS,
  FOREIGN_PROPERTY_INCOME_FIELDS, FOREIGN_PROPERTY_EXPENSE_FIELDS,
} from './map.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TAX_YEAR = /^\d{4}-\d{2}$/;
const NINO = /^(?!BG|GB|KN|NK|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/i;
const BUSINESS_ID = /^[A-Z0-9]{5,40}$/i;

function issue(code, message, field, source) {
  return { code, message, field: field || null, source: source || null };
}

function validDate(value) {
  if (!ISO_DATE.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateImport(mapped, payloads) {
  const errors = [];
  const warnings = [];
  const meta = payloads?.meta || {};
  if (!TAX_YEAR.test(String(meta.taxYear || ''))) errors.push(issue('INVALID_TAX_YEAR', 'Add a tax year in the format 2026-27.', 'tax_year'));
  if (!validDate(meta.periodStartDate)) errors.push(issue('INVALID_PERIOD_START', 'Add a valid period start date in YYYY-MM-DD format.', 'period_start'));
  if (!validDate(meta.periodEndDate)) errors.push(issue('INVALID_PERIOD_END', 'Add a valid period end date in YYYY-MM-DD format.', 'period_end'));
  if (validDate(meta.periodStartDate) && validDate(meta.periodEndDate) && meta.periodStartDate > meta.periodEndDate) errors.push(issue('PERIOD_REVERSED', 'The period end date must be after the start date.', 'period_end'));

  const allowed = {
    self_employment: new Set([...SE_INCOME_FIELDS, ...SE_EXPENSE_FIELDS, ...SE_ADDITIONS_FIELDS]),
    uk_property: new Set([...UK_PROPERTY_INCOME_FIELDS, ...UK_PROPERTY_EXPENSE_FIELDS]),
    foreign_property: new Set([...FOREIGN_PROPERTY_INCOME_FIELDS, ...FOREIGN_PROPERTY_EXPENSE_FIELDS]),
  };
  for (const trace of mapped.allTraces || []) {
    if (!allowed[trace.section]?.has(trace.canonicalField)) warnings.push(issue('UNRECOGNISED_CATEGORY', `“${trace.sourceField}” is not a supported ${trace.section.replace(/_/g, ' ')} category and will not be submitted.`, trace.sourceField, trace.section));
    if (trace.value < 0) warnings.push(issue('NEGATIVE_AMOUNT', `“${trace.sourceField}” contains a negative amount. Check that this is intentional.`, trace.sourceField, trace.section));
    if (Math.abs(trace.value) > 100000000) warnings.push(issue('LARGE_AMOUNT', `“${trace.sourceField}” is unusually large. Check the decimal point and units.`, trace.sourceField, trace.section));
  }
  for (const fp of mapped.foreignProperty || []) {
    if (!/^[A-Z]{3}$/.test(fp.countryCode) || fp.countryCode === 'ZZZ') errors.push(issue('INVALID_COUNTRY', 'Each foreign property entry needs a three-letter country code.', 'country_code', 'foreign_property'));
  }
  const income = [mapped.selfEmployment?.figures?.turnover, mapped.selfEmployment?.figures?.other, mapped.ukProperty?.figures?.period_amount, mapped.ukProperty?.figures?.other_income, ...(mapped.foreignProperty || []).flatMap((fp) => [fp.figures.rent_income, fp.figures.other_property_income])]
    .filter((v) => typeof v === 'number').reduce((sum, value) => sum + value, 0);
  if (income === 0) warnings.push(issue('NO_INCOME', 'No income was found. Continue only if a nil-income update is intended.'));
  return { ready: errors.length === 0, errors, warnings };
}

export function validateSubmission(payloads, ids = {}) {
  const errors = [];
  const nino = String(ids.nino || payloads?.meta?.nino || '').replace(/\s+/g, '').toUpperCase();
  const taxYear = String(ids.taxYear || payloads?.meta?.taxYear || '');
  if (!NINO.test(nino)) errors.push(issue('INVALID_NINO', 'Enter a valid National Insurance number.', 'nino'));
  if (!TAX_YEAR.test(taxYear)) errors.push(issue('INVALID_TAX_YEAR', 'Enter the tax year in the format 2026-27.', 'taxYear'));
  const requiredIds = [
    [payloads?.selfEmployment, ids.businessIdSe || payloads?.meta?.businessId, 'businessIdSe', 'self-employment'],
    [payloads?.ukProperty, ids.businessIdUk || payloads?.meta?.businessIdUk, 'businessIdUk', 'UK property'],
    [payloads?.foreignProperty, ids.businessIdForeign || payloads?.meta?.businessIdForeign, 'businessIdForeign', 'foreign property'],
  ];
  for (const [present, value, field, label] of requiredIds) {
    if (present && !BUSINESS_ID.test(String(value || ''))) errors.push(issue('INVALID_BUSINESS_ID', `Enter the HMRC business ID for ${label}.`, field, label));
  }
  return { ready: errors.length === 0, errors, normalized: { nino, taxYear } };
}
