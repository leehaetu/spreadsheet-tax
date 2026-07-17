/**
 * Canonical HMRC recognition status — single source of truth.
 * Flip RECOGNISED only when HMRC recognition is actually granted.
 */

/** @type {boolean} */
export const HMRC_RECOGNISED_SOFTWARE = false;

export const HMRC_RECOGNITION_SHORT = 'Not HMRC-recognised software';

export const HMRC_RECOGNITION_BANNER =
  'Not HMRC-recognised software — sandbox / pilot only until recognition is granted. Not for live recognised MTD filing.';

export const HMRC_RECOGNITION_FOOTER =
  'Not HMRC-recognised software. Not affiliated with or endorsed by HMRC. Live recognised filing is not claimed until recognition is granted.';

export const HMRC_RECOGNITION_NOTE =
  'Spreadsheet Tax is not on HMRC’s list of recognised Making Tax Digital software. We integrate with HMRC APIs in sandbox/pilot for development and evidence only. Do not market or use as HMRC-recognised software until recognition is granted.';

/**
 * Machine-readable block for /health, /api/integrity, /api/status.
 */
export function hmrcRecognitionPublic() {
  return {
    hmrcRecognisedSoftware: HMRC_RECOGNISED_SOFTWARE,
    hmrcRecognisedLabel: HMRC_RECOGNISED_SOFTWARE
      ? 'HMRC-recognised software'
      : HMRC_RECOGNITION_SHORT,
    hmrcRecognisedNote: HMRC_RECOGNITION_NOTE,
  };
}
