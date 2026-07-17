/**
 * Build HMRC MTD ITSA quarterly period-summary request payloads
 * from mapped local-file figures. Preserves field trace for digital link.
 */

/**
 * @typedef {import('./map.js').MappedPeriod} MappedPeriod
 * @typedef {import('./map.js').FieldTrace} FieldTrace
 */

/**
 * @typedef {object} QuarterlyPayloadBundle
 * @property {object | null} selfEmployment - HMRC SE period summary body
 * @property {object | null} ukProperty - HMRC UK property period summary body
 * @property {object | null} foreignProperty - HMRC foreign property period summary body
 * @property {object} meta - tax year, dates, business ids used
 * @property {FieldTrace[]} fieldLinks - file field → payload field digital links
 * @property {Array<{ source: string, path: string, value: number, sourceField: string }>} linkIndex
 */

/**
 * Default UK tax year quarter dates (illustrative; override via file metadata).
 * @param {string} taxYear e.g. "2024-25"
 */
export function defaultQuarterDates(taxYear) {
  const startYear = Number(String(taxYear).split('-')[0]);
  if (!Number.isFinite(startYear)) {
    return {
      periodDates: { periodStartDate: '2024-04-06', periodEndDate: '2024-07-05' },
    };
  }
  return {
    periodDates: {
      periodStartDate: `${startYear}-04-06`,
      periodEndDate: `${startYear}-07-05`,
    },
  };
}

/**
 * Round to 2 decimal places as HMRC monetary amounts typically require.
 * @param {number} n
 */
export function money2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Pick defined figure or omit.
 * @param {Record<string, number>} figures
 * @param {string} key
 * @returns {number | undefined}
 */
function fig(figures, key) {
  const v = figures[key];
  if (v === undefined || v === null) return undefined;
  return money2(v);
}

/**
 * Build nested object only including defined numeric leaves.
 * @param {Record<string, number | undefined | Record<string, unknown>>} obj
 */
function compact(obj) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = compact(/** @type {Record<string, unknown>} */ (v));
      if (Object.keys(nested).length) out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Self-employment cumulative period summary (HMRC create/amend period summary shape).
 * @param {Record<string, number>} figures
 * @param {{ periodStartDate: string, periodEndDate: string }} dates
 */
export function buildSelfEmploymentPeriodSummary(figures, dates) {
  const periodDates = {
    periodStartDate: dates.periodStartDate,
    periodEndDate: dates.periodEndDate,
  };

  const periodIncome = compact({
    turnover: fig(figures, 'turnover'),
    other: fig(figures, 'other'),
  });

  const periodExpenses = compact({
    costOfGoods: fig(figures, 'cost_of_goods'),
    paymentsToSubcontractors: fig(figures, 'payments_to_subcontractors'),
    wagesAndStaffCosts: fig(figures, 'wages_and_staff_costs'),
    carVanTravelExpenses: fig(figures, 'car_van_travel_expenses'),
    premisesRunningCosts: fig(figures, 'premises_running_costs'),
    maintenanceCosts: fig(figures, 'maintenance_costs'),
    adminCosts: fig(figures, 'admin_costs'),
    businessEntertainmentCosts: fig(figures, 'business_entertainment_costs'),
    advertisingCosts: fig(figures, 'advertising_costs'),
    interestOnBankOtherLoans: fig(figures, 'interest_on_bank_other_loans'),
    financeCharges: fig(figures, 'finance_charges'),
    irrecoverableDebts: fig(figures, 'irrecoverable_debts'),
    professionalFees: fig(figures, 'professional_fees'),
    depreciation: fig(figures, 'depreciation'),
    otherExpenses: fig(figures, 'other_expenses'),
  });

  const periodDisallowableExpenses = compact({
    costOfGoodsDisallowable: fig(figures, 'cost_of_goods_disallowable'),
    paymentsToSubcontractorsDisallowable: fig(
      figures,
      'payments_to_subcontractors_disallowable'
    ),
    wagesAndStaffCostsDisallowable: fig(
      figures,
      'wages_and_staff_costs_disallowable'
    ),
    carVanTravelExpensesDisallowable: fig(
      figures,
      'car_van_travel_expenses_disallowable'
    ),
    premisesRunningCostsDisallowable: fig(
      figures,
      'premises_running_costs_disallowable'
    ),
    maintenanceCostsDisallowable: fig(figures, 'maintenance_costs_disallowable'),
    adminCostsDisallowable: fig(figures, 'admin_costs_disallowable'),
    businessEntertainmentCostsDisallowable: fig(
      figures,
      'business_entertainment_costs_disallowable'
    ),
    advertisingCostsDisallowable: fig(figures, 'advertising_costs_disallowable'),
    interestOnBankOtherLoansDisallowable: fig(
      figures,
      'interest_on_bank_other_loans_disallowable'
    ),
    financeChargesDisallowable: fig(figures, 'finance_charges_disallowable'),
    irrecoverableDebtsDisallowable: fig(
      figures,
      'irrecoverable_debts_disallowable'
    ),
    professionalFeesDisallowable: fig(figures, 'professional_fees_disallowable'),
    depreciationDisallowable: fig(figures, 'depreciation_disallowable'),
    otherExpensesDisallowable: fig(figures, 'other_expenses_disallowable'),
  });

  return compact({
    periodDates,
    periodIncome,
    periodExpenses,
    periodDisallowableExpenses,
  });
}

/**
 * UK property non-FHL period summary body (HMRC Property Business API shape).
 * @param {Record<string, number>} figures
 * @param {{ periodStartDate: string, periodEndDate: string }} dates
 */
export function buildUkPropertyPeriodSummary(figures, dates) {
  const periodDates = {
    periodStartDate: dates.periodStartDate,
    periodEndDate: dates.periodEndDate,
  };

  const ukOtherProperty = compact({
    income: compact({
      periodAmount: fig(figures, 'period_amount'),
      premiumsOfLeaseGrant: fig(figures, 'premiums_of_lease_grant'),
      reversePremiums: fig(figures, 'reverse_premiums'),
      otherIncome: fig(figures, 'other_income'),
      taxDeducted: fig(figures, 'tax_deducted'),
      rentARoom: compact({
        rentsReceived: fig(figures, 'rent_a_room_rents_received'),
      }),
    }),
    expenses: compact({
      premisesRunningCosts: fig(figures, 'premises_running_costs'),
      repairsAndMaintenance: fig(figures, 'repairs_and_maintenance'),
      financialCosts: fig(figures, 'financial_costs'),
      professionalFees: fig(figures, 'professional_fees'),
      costOfServices: fig(figures, 'cost_of_services'),
      other: fig(figures, 'other'),
      residentialFinancialCost: fig(figures, 'residential_financial_cost'),
      travelCosts: fig(figures, 'travel_costs'),
      residentialFinancialCostsCarriedForward: fig(
        figures,
        'residential_financial_costs_carried_forward'
      ),
      rentARoom: compact({
        amountClaimed: fig(figures, 'rent_a_room_amount_claimed'),
      }),
    }),
  });

  return {
    fromDate: dates.periodStartDate,
    toDate: dates.periodEndDate,
    ukOtherProperty,
    // keep periodDates for clients that expect SE-style shape in previews
    periodDates,
  };
}

/**
 * Foreign property period summary for one or more countries.
 * @param {Array<{ countryCode: string, figures: Record<string, number> }>} countries
 * @param {{ periodStartDate: string, periodEndDate: string }} dates
 */
export function buildForeignPropertyPeriodSummary(countries, dates) {
  const foreignProperty = countries.map(({ countryCode, figures }) =>
    compact({
      countryCode,
      income: compact({
        rentIncome: compact({
          rentAmount: fig(figures, 'rent_income'),
        }),
        premiumsOfLeaseGrant: fig(figures, 'premiums_of_lease_grant'),
        otherPropertyIncome: fig(figures, 'other_property_income'),
        foreignTaxPaidOrDeducted: fig(figures, 'foreign_tax_paid_or_deducted'),
        specialWithholdingTaxOrUkTaxPaid: fig(
          figures,
          'special_withholding_tax_or_uk_tax_paid'
        ),
      }),
      expenses: compact({
        premisesRunningCosts: fig(figures, 'premises_running_costs'),
        repairsAndMaintenance: fig(figures, 'repairs_and_maintenance'),
        financialCosts: fig(figures, 'financial_costs'),
        professionalFees: fig(figures, 'professional_fees'),
        costOfServices: fig(figures, 'cost_of_services'),
        travelCosts: fig(figures, 'travel_costs'),
        other: fig(figures, 'other'),
        residentialFinancialCost: fig(figures, 'residential_financial_cost'),
        broughtFwdResidentialFinancialCost: fig(
          figures,
          'brought_fwd_residential_financial_cost'
        ),
      }),
    })
  );

  return {
    fromDate: dates.periodStartDate,
    toDate: dates.periodEndDate,
    foreignProperty,
    periodDates: {
      periodStartDate: dates.periodStartDate,
      periodEndDate: dates.periodEndDate,
    },
  };
}

/** Map canonical snake_case figure keys to HMRC camelCase payload paths */
const SE_LINK_PATHS = {
  turnover: 'periodIncome.turnover',
  other: 'periodIncome.other',
  cost_of_goods: 'periodExpenses.costOfGoods',
  payments_to_subcontractors: 'periodExpenses.paymentsToSubcontractors',
  wages_and_staff_costs: 'periodExpenses.wagesAndStaffCosts',
  car_van_travel_expenses: 'periodExpenses.carVanTravelExpenses',
  premises_running_costs: 'periodExpenses.premisesRunningCosts',
  maintenance_costs: 'periodExpenses.maintenanceCosts',
  admin_costs: 'periodExpenses.adminCosts',
  business_entertainment_costs: 'periodExpenses.businessEntertainmentCosts',
  advertising_costs: 'periodExpenses.advertisingCosts',
  interest_on_bank_other_loans: 'periodExpenses.interestOnBankOtherLoans',
  finance_charges: 'periodExpenses.financeCharges',
  irrecoverable_debts: 'periodExpenses.irrecoverableDebts',
  professional_fees: 'periodExpenses.professionalFees',
  depreciation: 'periodExpenses.depreciation',
  other_expenses: 'periodExpenses.otherExpenses',
};

const UK_LINK_PATHS = {
  period_amount: 'ukOtherProperty.income.periodAmount',
  premiums_of_lease_grant: 'ukOtherProperty.income.premiumsOfLeaseGrant',
  reverse_premiums: 'ukOtherProperty.income.reversePremiums',
  other_income: 'ukOtherProperty.income.otherIncome',
  tax_deducted: 'ukOtherProperty.income.taxDeducted',
  rent_a_room_rents_received: 'ukOtherProperty.income.rentARoom.rentsReceived',
  premises_running_costs: 'ukOtherProperty.expenses.premisesRunningCosts',
  repairs_and_maintenance: 'ukOtherProperty.expenses.repairsAndMaintenance',
  financial_costs: 'ukOtherProperty.expenses.financialCosts',
  professional_fees: 'ukOtherProperty.expenses.professionalFees',
  cost_of_services: 'ukOtherProperty.expenses.costOfServices',
  other: 'ukOtherProperty.expenses.other',
  residential_financial_cost: 'ukOtherProperty.expenses.residentialFinancialCost',
  travel_costs: 'ukOtherProperty.expenses.travelCosts',
  residential_financial_costs_carried_forward:
    'ukOtherProperty.expenses.residentialFinancialCostsCarriedForward',
  rent_a_room_amount_claimed: 'ukOtherProperty.expenses.rentARoom.amountClaimed',
};

const FOREIGN_LINK_PATHS = {
  rent_income: 'income.rentIncome.rentAmount',
  premiums_of_lease_grant: 'income.premiumsOfLeaseGrant',
  other_property_income: 'income.otherPropertyIncome',
  foreign_tax_paid_or_deducted: 'income.foreignTaxPaidOrDeducted',
  special_withholding_tax_or_uk_tax_paid:
    'income.specialWithholdingTaxOrUkTaxPaid',
  premises_running_costs: 'expenses.premisesRunningCosts',
  repairs_and_maintenance: 'expenses.repairsAndMaintenance',
  financial_costs: 'expenses.financialCosts',
  professional_fees: 'expenses.professionalFees',
  cost_of_services: 'expenses.costOfServices',
  travel_costs: 'expenses.travelCosts',
  other: 'expenses.other',
  residential_financial_cost: 'expenses.residentialFinancialCost',
  brought_fwd_residential_financial_cost:
    'expenses.broughtFwdResidentialFinancialCost',
};

/**
 * Build full quarterly payload bundle from mapped period.
 * @param {MappedPeriod} mapped
 * @returns {QuarterlyPayloadBundle}
 */
export function buildQuarterlyPayloads(mapped) {
  const taxYear = mapped.metadata.tax_year || '2024-25';
  const defaults = defaultQuarterDates(taxYear);
  const dates = {
    periodStartDate:
      mapped.metadata.period_start || defaults.periodDates.periodStartDate,
    periodEndDate:
      mapped.metadata.period_end || defaults.periodDates.periodEndDate,
  };

  /** @type {QuarterlyPayloadBundle} */
  const bundle = {
    selfEmployment: null,
    ukProperty: null,
    foreignProperty: null,
    meta: {
      taxYear,
      ...dates,
      businessId: mapped.metadata.business_id || null,
      nino: mapped.metadata.nino || null,
    },
    fieldLinks: mapped.allTraces,
    linkIndex: [],
  };

  if (mapped.selfEmployment) {
    bundle.selfEmployment = buildSelfEmploymentPeriodSummary(
      mapped.selfEmployment.figures,
      dates
    );
    for (const t of mapped.selfEmployment.trace) {
      const path = SE_LINK_PATHS[t.canonicalField];
      if (path) {
        bundle.linkIndex.push({
          source: 'self_employment',
          path,
          value: t.value,
          sourceField: t.sourceField,
        });
      }
    }
  }

  if (mapped.ukProperty) {
    bundle.ukProperty = buildUkPropertyPeriodSummary(
      mapped.ukProperty.figures,
      dates
    );
    for (const t of mapped.ukProperty.trace) {
      const path = UK_LINK_PATHS[t.canonicalField];
      if (path) {
        bundle.linkIndex.push({
          source: 'uk_property',
          path,
          value: t.value,
          sourceField: t.sourceField,
        });
      }
    }
  }

  if (mapped.foreignProperty.length > 0) {
    bundle.foreignProperty = buildForeignPropertyPeriodSummary(
      mapped.foreignProperty.map((fp) => ({
        countryCode: fp.countryCode,
        figures: fp.figures,
      })),
      dates
    );
    for (const fp of mapped.foreignProperty) {
      for (const t of fp.trace) {
        const path = FOREIGN_LINK_PATHS[t.canonicalField];
        if (path) {
          bundle.linkIndex.push({
            source: `foreign_property:${fp.countryCode}`,
            path: `foreignProperty[].${path}`,
            value: t.value,
            sourceField: t.sourceField,
          });
        }
      }
    }
  }

  return bundle;
}

/**
 * End-to-end: rows → map → payloads (shipped pipeline entry).
 * @param {Record<string, string>[]} rows
 */
export function rowsToQuarterlyPayloads(rows) {
  // Lazy import avoided — caller should use map + build; this re-exports pipeline
  throw new Error('Use mapRowsToPeriod + buildQuarterlyPayloads from the pipeline helper');
}
