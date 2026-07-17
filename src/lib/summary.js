/**
 * Customer-facing period summaries from mapped figures.
 * Pure helpers — no language enumerations.
 */

import {
  SE_INCOME_FIELDS,
  SE_EXPENSE_FIELDS,
  UK_PROPERTY_INCOME_FIELDS,
  UK_PROPERTY_EXPENSE_FIELDS,
  FOREIGN_PROPERTY_INCOME_FIELDS,
  FOREIGN_PROPERTY_EXPENSE_FIELDS,
} from './map.js';

/**
 * @param {Record<string, number>} figures
 * @param {string[]} keys
 */
function sumKeys(figures, keys) {
  let total = 0;
  for (const k of keys) {
    const v = figures[k];
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return Math.round(total * 100) / 100;
}

/**
 * @param {string} key
 */
export function humanFieldLabel(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {Record<string, number>} figures
 * @param {string[]} incomeKeys
 * @param {string[]} expenseKeys
 * @param {string} title
 * @param {string} [subtitle]
 */
function sourceSummary(figures, incomeKeys, expenseKeys, title, subtitle) {
  const incomeLines = [];
  const expenseLines = [];
  for (const k of incomeKeys) {
    if (figures[k] !== undefined && figures[k] !== null) {
      incomeLines.push({ field: k, label: humanFieldLabel(k), amount: figures[k] });
    }
  }
  for (const k of expenseKeys) {
    if (figures[k] !== undefined && figures[k] !== null) {
      expenseLines.push({ field: k, label: humanFieldLabel(k), amount: figures[k] });
    }
  }
  // Any extra mapped fields not in the known lists
  const known = new Set([...incomeKeys, ...expenseKeys]);
  for (const [k, v] of Object.entries(figures)) {
    if (known.has(k)) continue;
    if (typeof v !== 'number') continue;
    expenseLines.push({ field: k, label: humanFieldLabel(k), amount: v });
  }

  const totalIncome = sumKeys(
    figures,
    incomeLines.map((l) => l.field)
  );
  const totalExpenses = sumKeys(
    figures,
    expenseLines.map((l) => l.field)
  );
  const net = Math.round((totalIncome - totalExpenses) * 100) / 100;

  return {
    title,
    subtitle: subtitle || null,
    incomeLines,
    expenseLines,
    totalIncome,
    totalExpenses,
    net,
  };
}

/**
 * Build a full customer summary for the import preview UI.
 * @param {import('./map.js').MappedPeriod} mapped
 * @param {import('./payloads.js').QuarterlyPayloadBundle} payloads
 */
export function buildCustomerSummary(mapped, payloads) {
  /** @type {ReturnType<typeof sourceSummary>[]} */
  const sources = [];

  if (mapped.selfEmployment?.figures) {
    sources.push(
      sourceSummary(
        mapped.selfEmployment.figures,
        SE_INCOME_FIELDS,
        SE_EXPENSE_FIELDS,
        'Self-employment',
        'Trade / business income for the period'
      )
    );
  }
  if (mapped.ukProperty?.figures) {
    sources.push(
      sourceSummary(
        mapped.ukProperty.figures,
        UK_PROPERTY_INCOME_FIELDS,
        UK_PROPERTY_EXPENSE_FIELDS,
        'UK property',
        'UK rental income and expenses'
      )
    );
  }
  for (const fp of mapped.foreignProperty || []) {
    sources.push(
      sourceSummary(
        fp.figures,
        FOREIGN_PROPERTY_INCOME_FIELDS,
        FOREIGN_PROPERTY_EXPENSE_FIELDS,
        'Foreign property',
        `Country: ${fp.countryCode}`
      )
    );
  }

  const totalIncome = Math.round(
    sources.reduce((s, x) => s + x.totalIncome, 0) * 100
  ) / 100;
  const totalExpenses = Math.round(
    sources.reduce((s, x) => s + x.totalExpenses, 0) * 100
  ) / 100;
  const net = Math.round((totalIncome - totalExpenses) * 100) / 100;

  return {
    taxYear: payloads?.meta?.taxYear || mapped.metadata?.tax_year || null,
    periodStart:
      payloads?.meta?.periodStartDate || mapped.metadata?.period_start || null,
    periodEnd:
      payloads?.meta?.periodEndDate || mapped.metadata?.period_end || null,
    nino: mapped.metadata?.nino || null,
    sourceCount: sources.length,
    sources,
    totals: {
      totalIncome,
      totalExpenses,
      net,
    },
  };
}
