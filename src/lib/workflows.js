/**
 * Known customer/practice workflow names for /api/workflows/run.
 * Unknown names must fail before preview success.
 */

export const KNOWN_WORKFLOWS = [
  // Quarterly
  'se_period',
  'uk_period',
  'fp_period',
  // Corrections (all three sources)
  'se_amend',
  'uk_amend',
  'fp_amend',
  // Annual / EOY
  'final_obligations',
  'se_annual',
  'uk_annual',
  'fp_annual',
  'other_income',
  'losses',
  'calc',
  'calc_list',
  'bsas_trigger',
  'bsas_list',
  'bsas_adjust',
  'bsas_adjust_uk',
  'bsas_adjust_fp',
  'periods_of_account',
  'periods_of_account_put',
  'final_calc',
  // Self Assessment Assist (MTD)
  'sa_assist_report',
  'sa_assist_acknowledge',
];

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownWorkflow(name) {
  return KNOWN_WORKFLOWS.includes(String(name || ''));
}
