/**
 * Sanitised multi-sheet spreadsheet model for "Check your spreadsheet".
 * Never sends macros/scripts — values, optional formulas, cell refs, map states.
 */

/**
 * @typedef {'included'|'needs_review'|'ignored'|'invalid'|'duplicate'|'unassigned'} MapState
 */

/**
 * Build full check model from mapped period + raw rows.
 * @param {import('./map.js').MappedPeriod} mapped
 * @param {import('./payloads.js').QuarterlyPayloadBundle} payloads
 * @param {Record<string, string>[]} rawRows
 * @param {{
 *   filename?: string,
 *   fileSha256?: string|null,
 *   mappingVersion?: string,
 *   previousCheck?: object|null,
 *   previousCumulative?: object|null,
 * }} [meta]
 */
export function buildSpreadsheetCheckModel(
  mapped,
  payloads,
  rawRows = [],
  meta = {}
) {
  const traces = applyMapStates(mapped?.allTraces || [], meta.previousCheck);

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
    bucket.cells.push(cellFromTrace(t));
  }

  const categories = [...byCategory.values()].map((c) => ({
    ...c,
    total: round2(c.total),
    cellCount: c.cells.length,
  }));

  // Mapped-cell list (for filter / proof)
  const gridRows = traces.map((t, i) => ({
    id: `map-${i}`,
    cell: t.cell || `row-${t.row || i}`,
    sheet: t.sheet || 'Sheet1',
    row: t.row || null,
    col: t.col || null,
    description: t.sourceField,
    value: t.value,
    formula: t.formula || null,
    valueSource: t.formula ? 'formula_cached' : 'literal',
    mapState: t.mapState || 'included',
    categoryId: `${t.section}:${t.canonicalField}`,
    hmrcPath: humanField(t.section, t.canonicalField),
    section: t.section,
    reason: t.reason || '',
    country: t.country || null,
    fx: t.fx || null,
  }));

  // Full sanitised sheets (for virtualised grid)
  const sheets = buildSheetsFromRows(rawRows, traces);

  const outline = buildSourceOutline(mapped);

  const reuploadDiff = meta.previousCheck
    ? buildReuploadDiff(meta.previousCheck, {
        categories,
        gridRows,
        fileSha256: meta.fileSha256,
        filename: meta.filename,
      })
    : null;

  return {
    title: 'Check your spreadsheet',
    filename: meta.filename || null,
    fileSha256: meta.fileSha256 || null,
    mappingVersion: meta.mappingVersion || 'v1-deterministic',
    approvalInvalidated: Boolean(reuploadDiff?.hasChanges),
    legend: [
      { state: 'included', label: 'Included — mapped into an HMRC total', color: '#16a34a' },
      { state: 'needs_review', label: 'Needs review — ambiguous or unusual', color: '#d97706' },
      { state: 'ignored', label: 'Ignored — intentionally excluded', color: '#64748b' },
      { state: 'invalid', label: 'Invalid — cannot be submitted', color: '#dc2626' },
      { state: 'duplicate', label: 'Duplicate — matches a prior upload value', color: '#7c3aed' },
      { state: 'unassigned', label: 'Unassigned — in file, not mapped', color: '#94a3b8' },
    ],
    outline,
    sheets,
    categories,
    gridRows,
    reuploadDiff,
    linkCount: (payloads?.linkIndex || []).length,
    virtualisation: {
      rowWindow: 40,
      note: 'Browser loads a window of rows only; full sheet metadata stays on the model.',
    },
    approvalWording:
      'I have checked the spreadsheet cells and mappings shown above. The cumulative figures displayed are the figures I authorise Spreadsheet Tax to send to HMRC.',
    securityNote:
      'You are viewing a sanitised workbook representation — not the original Excel file. Macros, scripts and external links are never executed. If a figure is wrong, fix the original spreadsheet and upload again.',
  };
}

/**
 * Detect map states: invalid negatives, needs_review unknowns, duplicates vs previous.
 * @param {import('./map.js').FieldTrace[]} traces
 * @param {object|null} previousCheck
 */
export function applyMapStates(traces, previousCheck = null) {
  const prevValues = new Set();
  if (previousCheck?.gridRows) {
    for (const r of previousCheck.gridRows) {
      prevValues.add(`${r.section}|${r.description}|${r.value}`);
    }
  }
  return traces.map((t) => {
    const next = { ...t };
    if (next.value < 0) {
      next.mapState = 'invalid';
      next.reason = 'Negative amount needs correction in the source file';
    } else if (
      prevValues.has(`${t.section}|${t.sourceField}|${t.value}`) &&
      previousCheck
    ) {
      next.mapState = 'duplicate';
      next.reason =
        'Same field and value appeared in the previous upload — confirm not double-counted';
    } else if (!next.mapState) {
      next.mapState = 'included';
      next.reason =
        next.reason || `Column “${t.sourceField}” mapped to ${t.canonicalField}`;
    }
    // Foreign FX placeholder — never invent rates
    if (t.section === 'foreign_property') {
      next.fx = next.fx || {
        originalCurrency: null,
        originalAmount: null,
        rate: null,
        rateDate: null,
        sterlingAmount: t.value,
        rateSource: null,
        note: 'If the source file is not GBP, supply exchange rate and date — never invent rates.',
      };
    }
    return next;
  });
}

/**
 * @param {Record<string, string>[]} rawRows
 * @param {import('./map.js').FieldTrace[]} traces
 */
export function buildSheetsFromRows(rawRows, traces) {
  /** @type {Map<string, { name: string, headers: string[], rows: object[] }>} */
  const sheetMap = new Map();

  // Index traces by sheet+row for state overlay
  /** @type {Map<string, import('./map.js').FieldTrace[]>} */
  const bySheetRow = new Map();
  for (const t of traces) {
    const key = `${t.sheet || 'Sheet1'}|${t.row || ''}`;
    if (!bySheetRow.has(key)) bySheetRow.set(key, []);
    bySheetRow.get(key).push(t);
  }

  for (const raw of rawRows || []) {
    const sheetName = raw._sheet || 'Sheet1';
    if (!sheetMap.has(sheetName)) {
      sheetMap.set(sheetName, { name: sheetName, headers: [], rows: [] });
    }
    const sheet = sheetMap.get(sheetName);
    const rowNum = Number(raw._row) || sheet.rows.length + 2;
    /** @type {Record<string, object>} */
    const cells = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith('_')) continue;
      if (!sheet.headers.includes(k)) sheet.headers.push(k);
      const col = raw[`_col_${k}`] || null;
      const cellRef = col ? `${sheetName}!${col}${rowNum}` : null;
      const formulaKey = `_formula_${k}`;
      const formula = raw[formulaKey] || null;
      // default unassigned
      let mapState = 'unassigned';
      let categoryId = null;
      let reason = 'Not mapped to an HMRC total';
      const tracesHere = bySheetRow.get(`${sheetName}|${rowNum}`) || [];
      const match = tracesHere.find(
        (t) =>
          t.sourceField === k ||
          t.col === col ||
          (t.cell && cellRef && t.cell === cellRef)
      );
      if (match) {
        mapState = match.mapState || 'included';
        categoryId = `${match.section}:${match.canonicalField}`;
        reason = match.reason || reason;
      } else if (k === 'section' || k === 'field' || k === 'category') {
        mapState = 'ignored';
        reason = 'Structural column';
      }
      // totals row heuristic
      if (
        /total|sum|grand/i.test(String(v)) ||
        /total|sum/i.test(String(raw.field || raw.category || ''))
      ) {
        if (mapState === 'included') {
          mapState = 'needs_review';
          reason = 'Looks like a totals row — confirm it is not double-counting';
        }
      }
      cells[k] = {
        value: v,
        formula: formula || null,
        valueSource: formula ? 'formula_cached' : 'literal',
        col,
        cell: cellRef,
        mapState,
        categoryId,
        reason,
      };
    }
    sheet.rows.push({
      row: rowNum,
      cells,
      section: raw.section || null,
    });
  }

  // Ensure headers stable
  return [...sheetMap.values()].map((s) => ({
    name: s.name,
    headers: s.headers,
    rowCount: s.rows.length,
    rows: s.rows,
  }));
}

/**
 * @param {import('./map.js').MappedPeriod} mapped
 */
export function buildSourceOutline(mapped) {
  /** @type {object[]} */
  const outline = [];
  if (mapped?.selfEmployment) {
    outline.push({
      id: 'self_employment',
      type: 'self_employment',
      label: 'Self-employment',
      status: 'active',
    });
  }
  if (mapped?.ukProperty) {
    outline.push({
      id: 'uk_property',
      type: 'uk_property',
      label: 'UK property',
      status: 'active',
    });
  }
  for (const fp of mapped?.foreignProperty || []) {
    outline.push({
      id: `foreign_property:${fp.countryCode}`,
      type: 'foreign_property',
      label: `Foreign property — ${fp.countryCode}`,
      countryCode: fp.countryCode,
      status: 'active',
    });
  }
  outline.push({
    id: 'unassigned',
    type: 'unassigned',
    label: 'Unassigned records',
    status: 'filter',
  });
  return outline;
}

/**
 * Compare previous check model vs new categories/grid.
 * @param {object} previous
 * @param {object} current
 */
export function buildReuploadDiff(previous, current) {
  /** @type {Map<string, number>} */
  const prevTotals = new Map();
  for (const c of previous.categories || []) {
    prevTotals.set(c.id, c.total);
  }
  /** @type {object[]} */
  const changes = [];
  for (const c of current.categories || []) {
    const prev = prevTotals.has(c.id) ? prevTotals.get(c.id) : null;
    if (prev === null) {
      changes.push({
        categoryId: c.id,
        label: c.label,
        previous: null,
        replacement: c.total,
        delta: c.total,
        kind: 'added',
      });
    } else if (round2(prev) !== round2(c.total)) {
      changes.push({
        categoryId: c.id,
        label: c.label,
        previous: prev,
        replacement: c.total,
        delta: round2(c.total - prev),
        kind: 'changed',
      });
    }
    prevTotals.delete(c.id);
  }
  for (const [id, prev] of prevTotals) {
    changes.push({
      categoryId: id,
      label: id,
      previous: prev,
      replacement: null,
      delta: round2(-prev),
      kind: 'removed',
    });
  }

  // Cell-level add/remove (by cell+value key)
  const prevCells = new Set(
    (previous.gridRows || []).map((r) => `${r.cell}|${r.value}|${r.categoryId}`)
  );
  const curCells = new Set(
    (current.gridRows || []).map((r) => `${r.cell}|${r.value}|${r.categoryId}`)
  );
  let cellsAdded = 0;
  let cellsRemoved = 0;
  for (const k of curCells) if (!prevCells.has(k)) cellsAdded++;
  for (const k of prevCells) if (!curCells.has(k)) cellsRemoved++;

  return {
    hasChanges: changes.length > 0 || cellsAdded > 0 || cellsRemoved > 0,
    previousFilename: previous.filename || null,
    previousHash: previous.fileSha256 || null,
    replacementFilename: current.filename || null,
    replacementHash: current.fileSha256 || null,
    categoryChanges: changes,
    cellsAdded,
    cellsRemoved,
    note: 'Previous approvals are invalidated when contributing cells or mappings change.',
  };
}

function cellFromTrace(t) {
  return {
    cell: t.cell || null,
    sheet: t.sheet || 'Sheet1',
    row: t.row || null,
    col: t.col || null,
    sourceField: t.sourceField,
    value: t.value,
    formula: t.formula || null,
    mapState: t.mapState || 'included',
    reason: t.reason || '',
    country: t.country || null,
    fx: t.fx || null,
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

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}
