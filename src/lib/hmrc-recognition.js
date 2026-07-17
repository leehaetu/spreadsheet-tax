/**
 * Canonical HMRC recognition status — single source of truth.
 * Flip RECOGNISED only when HMRC recognition is actually granted.
 */

/**
 * Goal for the product programme (marketing/plan language).
 * Flip RECOGNISED only when HMRC listing/recognition is actually granted.
 */
/** @type {boolean} */
export const HMRC_RECOGNISED_SOFTWARE = false;

/** Programme goal — always use this phrase for destination */
export const HMRC_RECOGNISED_GOAL = 'HMRC Recognised';

export const HMRC_RECOGNITION_SHORT = HMRC_RECOGNISED_SOFTWARE
  ? 'HMRC Recognised'
  : 'Building toward HMRC Recognised · Not yet recognised';

export const HMRC_RECOGNITION_BANNER = HMRC_RECOGNISED_SOFTWARE
  ? 'HMRC Recognised Making Tax Digital software.'
  : 'Goal: HMRC Recognised · Status: not yet recognised — sandbox / pilot only. Not for live recognised MTD filing until recognition is granted.';

export const HMRC_RECOGNITION_FOOTER = HMRC_RECOGNISED_SOFTWARE
  ? 'HMRC Recognised software. Not affiliated with HMRC beyond recognition listing.'
  : 'Goal: HMRC Recognised. Status: not yet on HMRC’s recognised list. Sandbox/pilot only until recognition is granted. Not affiliated with or endorsed by HMRC.';

export const HMRC_RECOGNITION_NOTE = HMRC_RECOGNISED_SOFTWARE
  ? 'Spreadsheet Tax is HMRC-recognised Making Tax Digital software.'
  : 'Programme goal is HMRC Recognised. Spreadsheet Tax is not yet on HMRC’s recognised list. Sandbox/pilot development only. Do not market as recognised until granted.';

/**
 * Machine-readable block for /health, /api/integrity, /api/status.
 */
export function hmrcRecognitionPublic() {
  return {
    hmrcRecognisedSoftware: HMRC_RECOGNISED_SOFTWARE,
    hmrcRecognisedGoal: HMRC_RECOGNISED_GOAL,
    hmrcRecognisedLabel: HMRC_RECOGNITION_SHORT,
    hmrcRecognisedNote: HMRC_RECOGNITION_NOTE,
  };
}
