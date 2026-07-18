/**
 * Print machine-readable honesty map from code (not HTTP).
 * Usage: node scripts/print-integrity-map.mjs
 */
import { buildIntegrityMap } from '../src/lib/integrity-map.js';

console.log(JSON.stringify(buildIntegrityMap(), null, 2));
