/**
 * Sanitised spreadsheet representation for "Check your spreadsheet".
 * Never sends macros/scripts — only values + mapping states for the browser.
 */

/**
 * @param {import('./map.js').MappedPeriod} mapped
 * @param {import('./payloads.js').QuarterlyPayloadBundle} payloads
 * @param {{ filename?: string, fileSha256?: string|null, mappingVersion?: string }} [meta]
 */
export function buildSpreadsheetCheckModel(mapped, payloads, meta = {}) {
  const links = payloads?.linkIndex || [];
  const traces = mapped?.allTraces || [];

  /** @type {Map<string, object>} */
  const byCategory = new Map();
  for (const t of traces) {
    const cat = `${t.section}:${t.canonicalField}`;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, {
        id: cat,
        section: t.section,
        field: t.canonicalField,
        label: humanField(t.section, t.canonicalField),
        total: 0,
        cells: [],
      });
    }
    const bucket = byCategory.get(cat);
    bucket.total += Number(t.value) || 0;
    bucket.cells.push({
      cell: t.cell || null,
      sheet: t.sheet || 'Sheet1',
      row: t.row || null,
      col: t.col || null,
      sourceField: t.sourceField,
      value: t.value,
      mapState: t.mapState || 'included',
      reason: t.reason || '',
      country: t.country || null,
    });
  }

  // Grid rows for browser table (virtualisation-friendly list, not full xlsx)
  const gridRows = traces.map((t, i) => ({
    id: `cell-${i}`,
    cell: t.cell || `row-${t.row || i}`,
    sheet: t.sheet || 'Sheet1',
    row: t.row || null,
    col: t.col || null,
    description: t.sourceField,
    value: t.value,
    mapState: t.mapState || 'included',
    categoryId: `${t.section}:${t.canonicalField}`,
    hmrcPath: humanField(t.section, t.canonicalField),
    section: t.section,
    reason: t.reason || '',
    country: t.country || null,
  }));

  const categories = [...byCategory.values()].map((c) => ({
    ...c,
    total: Math.round(c.total * 100) / 100,
    cellCount: c.cells.length,
  }));

  return {
    title: 'Check your spreadsheet',
    filename: meta.filename || null,
    fileSha256: meta.fileSha256 || null,
    mappingVersion: meta.mappingVersion || 'v1-deterministic',
    legend: [
      { state: 'included', label: 'Included — mapped into an HMRC total' },
      { state: 'needs_review', label: 'Needs review — ambiguous' },
      { state: 'ignored', label: 'Ignored — intentionally excluded' },
      { state: 'invalid', label: 'Invalid — cannot submit' },
      { state: 'duplicate', label: 'Duplicate — appears already imported' },
    ],
    categories,
    gridRows,
    linkCount: links.length,
    approvalWording:
      'I have checked the spreadsheet cells and mappings shown above. The cumulative figures displayed are the figures I authorise Spreadsheet Tax to send to HMRC.',
    securityNote:
      'You are viewing a sanitised mapping of values and cell references — not the original Excel file. Macros and external links are never executed.',
  };
}

function humanField(section, field) {
  const sec =
    section === 'self_employment'
      ? 'Self-employment'
      : section === 'uk_property'
        ? 'UK property'
        : section === 'foreign_property'
          ? 'Foreign property'
          : section;
  return `${sec} → ${String(field).replace(/_/g, ' ')}`;
}
