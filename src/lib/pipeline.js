/**
 * Shipped pipeline: local file buffer/text → parse → map → quarterly payloads.
 */

import { parseCsvText, parseFileBuffer } from './parse.js';
import { mapRowsToPeriod } from './map.js';
import { buildQuarterlyPayloads } from './payloads.js';

/**
 * Process a local file into mapped figures and HMRC quarterly payloads.
 * @param {Buffer | string} input
 * @param {string} [filename]
 */
export function processLocalFile(input, filename = 'upload.csv') {
  const rows =
    typeof input === 'string'
      ? parseCsvText(input)
      : parseFileBuffer(input, filename);

  const mapped = mapRowsToPeriod(rows);
  const payloads = buildQuarterlyPayloads(mapped);

  return {
    rowCount: rows.length,
    mapped,
    payloads,
  };
}
