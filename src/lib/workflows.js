/**
 * Known customer/practice workflow names for /api/workflows/run.
 * Unknown names must fail before preview success.
 */

export const KNOWN_WORKFLOWS = [
  // Quarterly
  'se_period',
  'uk_period',
  'fp_period',
  // Corrections
  'se_amend',
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
  'final_calc',
];

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownWorkflow(name) {
  return KNOWN_WORKFLOWS.includes(String(name || ''));
}
