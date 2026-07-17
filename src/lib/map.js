/**
 * Map parsed spreadsheet rows to normalized income-source figures.
 * Primary path: file fields → structured totals (no hand re-keying).
 */

import { extractMetadata, normalizeHeader } from './parse.js';

/** @typedef {'self_employment' | 'uk_property' | 'foreign_property'} IncomeSource */

/**
 * Canonical self-employment period summary fields (HMRC ITSA SE).
 * Values are numeric strings from the file; mapping preserves source field names.
 */
export const SE_INCOME_FIELDS = ['turnover', 'other'];
export const SE_EXPENSE_FIELDS = [
  'cost_of_goods',
  'payments_to_subcontractors',
  'wages_and_staff_costs',
  'car_van_travel_expenses',
  'premises_running_costs',
  'maintenance_costs',
  'admin_costs',
  'business_entertainment_costs',
  'advertising_costs',
  'interest_on_bank_other_loans',
  'finance_charges',
  'irrecoverable_debts',
  'professional_fees',
  'depreciation',
  'other_expenses',
];
export const SE_ADDITIONS_FIELDS = [
  'cost_of_goods_disallowable',
  'payments_to_subcontractors_disallowable',
  'wages_and_staff_costs_disallowable',
  'car_van_travel_expenses_disallowable',
  'premises_running_costs_disallowable',
  'maintenance_costs_disallowable',
  'admin_costs_disallowable',
  'business_entertainment_costs_disallowable',
  'advertising_costs_disallowable',
  'interest_on_bank_other_loans_disallowable',
  'finance_charges_disallowable',
  'irrecoverable_debts_disallowable',
  'professional_fees_disallowable',
  'depreciation_disallowable',
  'other_expenses_disallowable',
];

export const UK_PROPERTY_INCOME_FIELDS = [
  'period_amount',
  'premiums_of_lease_grant',
  'reverse_premiums',
  'other_income',
  'tax_deducted',
  'rent_a_room_rents_received',
];
export const UK_PROPERTY_EXPENSE_FIELDS = [
  'premises_running_costs',
  'repairs_and_maintenance',
  'financial_costs',
  'professional_fees',
  'cost_of_services',
  'other',
  'residential_financial_cost',
  'travel_costs',
  'residential_financial_costs_carried_forward',
  'rent_a_room_amount_claimed',
];

export const FOREIGN_PROPERTY_INCOME_FIELDS = [
  'rent_income',
  'premiums_of_lease_grant',
  'other_property_income',
  'foreign_tax_paid_or_deducted',
  'special_withholding_tax_or_uk_tax_paid',
];
export const FOREIGN_PROPERTY_EXPENSE_FIELDS = [
  'premises_running_costs',
  'repairs_and_maintenance',
  'financial_costs',
  'professional_fees',
  'cost_of_services',
  'travel_costs',
  'other',
  'residential_financial_cost',
  'brought_fwd_residential_financial_cost',
];

const SECTION_ALIASES = {
  self_employment: 'self_employment',
  'self-employment': 'self_employment',
  se: 'self_employment',
  selfemployment: 'self_employment',
  trade: 'self_employment',
  business: 'self_employment',
  uk_property: 'uk_property',
  'uk-property': 'uk_property',
  ukproperty: 'uk_property',
  property_uk: 'uk_property',
  foreign_property: 'foreign_property',
  'foreign-property': 'foreign_property',
  foreignproperty: 'foreign_property',
  property_foreign: 'foreign_property',
};

/**
 * @param {string} section
 * @returns {IncomeSource | null}
 */
export function normalizeSection(section) {
  const key = normalizeHeader(section);
  return /** @type {IncomeSource | null} */ (SECTION_ALIASES[key] ?? null);
}

/**
 * Parse a monetary value from spreadsheet cell text.
 * @param {unknown} raw
 * @returns {number | undefined}
 */
export function parseMoney(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  let s = String(raw).trim();
  if (!s) return undefined;
  // Strip currency symbols and thousands separators
  s = s.replace(/[£$€,\s]/g, '');
  // Parentheses for negative
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Shared aliases safe across all income sources (no conflicting meanings).
 */
const SHARED_FIELD_ALIASES = {
  premiums_of_lease_grant: 'premiums_of_lease_grant',
  reverse_premiums: 'reverse_premiums',
  premises_running_costs: 'premises_running_costs',
  premises: 'premises_running_costs',
  professional_fees: 'professional_fees',
  accountancy: 'professional_fees',
  legal: 'professional_fees',
  cost_of_services: 'cost_of_services',
  financial_costs: 'financial_costs',
  residential_financial_cost: 'residential_financial_cost',
  travel_costs: 'travel_costs',
};

/**
 * Section-specific aliases. SE "other_income"→"other" must NOT apply to property,
 * where other_income is income and other is an expense.
 * @type {Record<IncomeSource, Record<string, string>>}
 */
const SECTION_FIELD_ALIASES = {
  self_employment: {
    turnover: 'turnover',
    sales: 'turnover',
    income: 'turnover',
    revenue: 'turnover',
    other_income: 'other',
    other: 'other',
    cost_of_goods: 'cost_of_goods',
    cost_of_sales: 'cost_of_goods',
    materials: 'cost_of_goods',
    subcontractors: 'payments_to_subcontractors',
    payments_to_subcontractors: 'payments_to_subcontractors',
    wages: 'wages_and_staff_costs',
    wages_and_staff_costs: 'wages_and_staff_costs',
    staff_costs: 'wages_and_staff_costs',
    car_van_travel: 'car_van_travel_expenses',
    car_van_travel_expenses: 'car_van_travel_expenses',
    travel: 'car_van_travel_expenses',
    rent: 'premises_running_costs',
    maintenance: 'maintenance_costs',
    maintenance_costs: 'maintenance_costs',
    repairs: 'maintenance_costs',
    admin: 'admin_costs',
    admin_costs: 'admin_costs',
    office_costs: 'admin_costs',
    entertainment: 'business_entertainment_costs',
    business_entertainment_costs: 'business_entertainment_costs',
    advertising: 'advertising_costs',
    advertising_costs: 'advertising_costs',
    marketing: 'advertising_costs',
    interest: 'interest_on_bank_other_loans',
    interest_on_bank_other_loans: 'interest_on_bank_other_loans',
    finance_charges: 'finance_charges',
    bank_charges: 'finance_charges',
    bad_debts: 'irrecoverable_debts',
    irrecoverable_debts: 'irrecoverable_debts',
    depreciation: 'depreciation',
    other_expenses: 'other_expenses',
    sundry: 'other_expenses',
  },
  uk_property: {
    period_amount: 'period_amount',
    rental_income: 'period_amount',
    rent_income: 'period_amount',
    rents_received: 'period_amount',
    // income: keep other_income distinct from expense "other"
    other_income: 'other_income',
    other: 'other',
    tax_deducted: 'tax_deducted',
    rent_a_room_rents_received: 'rent_a_room_rents_received',
    repairs_and_maintenance: 'repairs_and_maintenance',
    repairs: 'repairs_and_maintenance',
    maintenance: 'repairs_and_maintenance',
    residential_financial_costs_carried_forward:
      'residential_financial_costs_carried_forward',
    rent_a_room_amount_claimed: 'rent_a_room_amount_claimed',
  },
  foreign_property: {
    rent_income: 'rent_income',
    foreign_rent_income: 'rent_income',
    rental_income: 'rent_income',
    period_amount: 'rent_income',
    turnover: 'rent_income',
    // income aliases → other_property_income (not SE "other" or UK expense "other")
    other_income: 'other_property_income',
    other_property_income: 'other_property_income',
    other: 'other_property_income',
    foreign_tax_paid_or_deducted: 'foreign_tax_paid_or_deducted',
    special_withholding_tax_or_uk_tax_paid:
      'special_withholding_tax_or_uk_tax_paid',
    repairs_and_maintenance: 'repairs_and_maintenance',
    repairs: 'repairs_and_maintenance',
    brought_fwd_residential_financial_cost:
      'brought_fwd_residential_financial_cost',
  },
};

/**
 * Canonicalize a spreadsheet field name for a given income source section.
 * Section-aware so SE aliases (e.g. other_income→other) do not corrupt
 * UK property income.otherIncome or foreign otherPropertyIncome.
 * @param {string} field
 * @param {IncomeSource | null | undefined} [section]
 * @returns {string}
 */
export function canonicalizeField(field, section = null) {
  const key = normalizeHeader(field);
  if (section && SECTION_FIELD_ALIASES[section]?.[key]) {
    return SECTION_FIELD_ALIASES[section][key];
  }
  if (SHARED_FIELD_ALIASES[key]) return SHARED_FIELD_ALIASES[key];
  // Fallback without section: only shared + identity (no SE-only remaps)
  return key;
}

/**
 * @typedef {object} FieldTrace
 * @property {string} sourceField - original spreadsheet field label
 * @property {string} canonicalField
 * @property {number} value
 * @property {IncomeSource} section
 * @property {string} [country]
 */

/**
 * @typedef {object} MappedPeriod
 * @property {Record<string, string>} metadata
 * @property {{ figures: Record<string, number>, trace: FieldTrace[] } | null} selfEmployment
 * @property {{ figures: Record<string, number>, trace: FieldTrace[] } | null} ukProperty
 * @property {Array<{ countryCode: string, figures: Record<string, number>, trace: FieldTrace[] }>} foreignProperty
 * @property {FieldTrace[]} allTraces - digital link file → mapped fields
 */

/**
 * Map raw rows into structured period figures for all supported sources.
 * @param {Record<string, string>[]} rows
 * @returns {MappedPeriod}
 */
export function mapRowsToPeriod(rows) {
  const metadata = extractMetadata(rows);
  /** @type {Record<string, number>} */
  const seFigures = {};
  /** @type {FieldTrace[]} */
  const seTrace = [];
  /** @type {Record<string, number>} */
  const ukFigures = {};
  /** @type {FieldTrace[]} */
  const ukTrace = [];
  /** @type {Map<string, { figures: Record<string, number>, trace: FieldTrace[] }>} */
  const foreignByCountry = new Map();
  /** @type {FieldTrace[]} */
  const allTraces = [];

  for (const row of rows) {
    const section = normalizeSection(row.section || '');
    if (!section) continue;

    const sourceField = row.field || row.key || row.category || '';
    if (!sourceField) {
      // Wide format: each numeric column is a field
      for (const [col, val] of Object.entries(row)) {
        if (['section', 'country', 'country_code', 'business_id'].includes(col))
          continue;
        const money = parseMoney(val);
        if (money === undefined) continue;
        applyFigure(
          section,
          col,
          col,
          money,
          row.country || row.country_code,
          seFigures,
          seTrace,
          ukFigures,
          ukTrace,
          foreignByCountry,
          allTraces
        );
      }
      continue;
    }

    const money = parseMoney(row.value ?? row.amount ?? row.total);
    if (money === undefined) continue;

    applyFigure(
      section,
      sourceField,
      sourceField,
      money,
      row.country || row.country_code,
      seFigures,
      seTrace,
      ukFigures,
      ukTrace,
      foreignByCountry,
      allTraces
    );
  }

  return {
    metadata,
    selfEmployment:
      Object.keys(seFigures).length > 0
        ? { figures: seFigures, trace: seTrace }
        : null,
    ukProperty:
      Object.keys(ukFigures).length > 0
        ? { figures: ukFigures, trace: ukTrace }
        : null,
    foreignProperty: [...foreignByCountry.entries()].map(
      ([countryCode, data]) => ({
        countryCode,
        figures: data.figures,
        trace: data.trace,
      })
    ),
    allTraces,
  };
}

/**
 * @param {IncomeSource} section
 * @param {string} sourceField
 * @param {string} rawCanonical
 * @param {number} money
 * @param {string | undefined} country
 * @param {Record<string, number>} seFigures
 * @param {FieldTrace[]} seTrace
 * @param {Record<string, number>} ukFigures
 * @param {FieldTrace[]} ukTrace
 * @param {Map<string, { figures: Record<string, number>, trace: FieldTrace[] }>} foreignByCountry
 * @param {FieldTrace[]} allTraces
 */
function applyFigure(
  section,
  sourceField,
  rawCanonical,
  money,
  country,
  seFigures,
  seTrace,
  ukFigures,
  ukTrace,
  foreignByCountry,
  allTraces
) {
  const canonical = canonicalizeField(rawCanonical, section);
  /** @type {FieldTrace} */
  const trace = {
    sourceField: String(sourceField),
    canonicalField: canonical,
    value: money,
    section,
  };

  if (section === 'self_employment') {
    seFigures[canonical] = (seFigures[canonical] ?? 0) + money;
    seTrace.push(trace);
    allTraces.push(trace);
    return;
  }
  if (section === 'uk_property') {
    ukFigures[canonical] = (ukFigures[canonical] ?? 0) + money;
    ukTrace.push(trace);
    allTraces.push(trace);
    return;
  }
  if (section === 'foreign_property') {
    const code = (country || 'ZZZ').toUpperCase().slice(0, 3);
    trace.country = code;
    let bucket = foreignByCountry.get(code);
    if (!bucket) {
      bucket = { figures: {}, trace: [] };
      foreignByCountry.set(code, bucket);
    }
    bucket.figures[canonical] = (bucket.figures[canonical] ?? 0) + money;
    bucket.trace.push(trace);
    allTraces.push(trace);
  }
}
