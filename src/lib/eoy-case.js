/**
 * End-of-year tax return case — product stages (not API checklist).
 */

import { getDb } from './db.js';
import { newId } from './auth.js';
import { listIncomeSources, defaultTaxYear } from './taxpayer-journey.js';

/** Human stages for the tax return journey */
export const EOY_STAGES = [
  {
    id: 'quarterly_complete',
    title: 'Confirm quarterly updates are done',
    detail:
      'All required quarterly updates for this tax year should be with HMRC before year-end adjustments.',
  },
  {
    id: 'review_totals',
    title: 'Review annual totals by business',
    detail:
      'Check the year-to-date digital records for each self-employment and property source.',
  },
  {
    id: 'se_adjustments',
    title: 'Self-employment tax adjustments',
    detail:
      'Add allowances and accounting adjustments (not quarterly trading totals).',
  },
  {
    id: 'uk_adjustments',
    title: 'UK property tax adjustments',
    detail: 'Annual property adjustments where they apply.',
  },
  {
    id: 'foreign_adjustments',
    title: 'Foreign property tax adjustments',
    detail: 'Annual foreign property adjustments; exchange rates must be evidenced.',
  },
  {
    id: 'other_income_losses',
    title: 'Other income, losses and reliefs',
    detail: 'Bring in other income, losses and claims as required for the return.',
  },
  {
    id: 'calculation',
    title: 'Tax calculation',
    detail: 'Ask HMRC for a calculation and review the result carefully.',
  },
  {
    id: 'hmrc_assist',
    title: 'HMRC Assist feedback',
    detail:
      'Request HMRC’s Self Assessment Assist report for this calculation, read HMRC’s messages, then confirm you have seen them.',
  },
  {
    id: 'bsas',
    title: 'Adjustable summary (if needed)',
    detail: 'Only if you need to adjust the HMRC summary (BSAS).',
  },
  {
    id: 'final_declaration',
    title: 'Final declaration',
    detail:
      'Only when you are ready to finalise. Use HMRC’s declaration wording.',
  },
  {
    id: 'complete',
    title: 'Return complete',
    detail: 'Keep your receipt and evidence pack.',
  },
];

/**
 * @param {string} userId
 * @param {string} [taxYear]
 */
export function getEoyCase(userId, taxYear) {
  const ty = taxYear || defaultTaxYear();
  const row = getDb()
    .prepare(
      `SELECT * FROM eoy_cases WHERE user_id = ? AND tax_year = ?`
    )
    .get(userId, ty);
  const sources = listIncomeSources(userId);
  const foreignPropertyRecords = latestForeignPropertyRecords(userId);
  if (!row) {
    return {
      userId,
      taxYear: ty,
      stageId: 'quarterly_complete',
      stageIndex: 0,
      completedStages: [],
      notes: {},
      data: {},
      sources,
      foreignPropertyRecords,
      stages: EOY_STAGES,
    };
  }
  const completed = row.completed_json
    ? JSON.parse(row.completed_json)
    : [];
  const stageId = row.stage_id || 'quarterly_complete';
  const stageIndex = Math.max(
    0,
    EOY_STAGES.findIndex((s) => s.id === stageId)
  );
  return {
    userId,
    taxYear: ty,
    stageId,
    stageIndex,
    completedStages: completed,
    notes: row.notes_json ? JSON.parse(row.notes_json) : {},
    data: row.data_json ? JSON.parse(row.data_json) : {},
    sources,
    foreignPropertyRecords,
    stages: EOY_STAGES,
    updatedAt: row.updated_at,
  };
}

function latestForeignPropertyRecords(userId) {
  const rows = getDb()
    .prepare(
      `SELECT payloads_json FROM drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(userId);
  const records = new Map();
  for (const row of rows) {
    let payloads;
    try {
      payloads = JSON.parse(row.payloads_json);
    } catch {
      continue;
    }
    const list =
      payloads?.foreignProperty?.foreignProperty ||
      payloads?.foreignProperty?.foreignNonFhlProperty ||
      [];
    for (const entry of Array.isArray(list) ? list : []) {
      const countryCode = String(entry.countryCode || '').toUpperCase();
      if (/^[A-Z]{3}$/.test(countryCode) && !records.has(countryCode)) {
        records.set(countryCode, {
          id: `country-${countryCode}`,
          countryCode,
          label: countryCode,
        });
      }
    }
  }
  return [...records.values()];
}

/**
 * @param {string} userId
 * @param {{ taxYear?: string, stageId?: string, completeCurrent?: boolean, note?: string, data?: Record<string, unknown> }} patch
 */
export function updateEoyCase(userId, patch = {}) {
  const ty = patch.taxYear || defaultTaxYear();
  const cur = getEoyCase(userId, ty);
  let stageId = patch.stageId || cur.stageId;
  let completed = [...(cur.completedStages || [])];
  const notes = { ...cur.notes };
  const data = { ...(cur.data || {}), ...(patch.data || {}) };

  if (patch.note) {
    notes[stageId] = String(patch.note).slice(0, 2000);
  }

  if (patch.completeCurrent) {
    if (!completed.includes(cur.stageId)) completed.push(cur.stageId);
    const idx = EOY_STAGES.findIndex((s) => s.id === cur.stageId);
    if (idx >= 0 && idx < EOY_STAGES.length - 1) {
      stageId = EOY_STAGES[idx + 1].id;
    } else {
      stageId = 'complete';
    }
  }

  if (patch.stageId) {
    stageId = patch.stageId;
  }

  const now = new Date().toISOString();
  const exists = getDb()
    .prepare(`SELECT 1 FROM eoy_cases WHERE user_id = ? AND tax_year = ?`)
    .get(userId, ty);
  if (!exists) {
    getDb()
      .prepare(
        `INSERT INTO eoy_cases (id, user_id, tax_year, stage_id, completed_json, notes_json, data_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newId(),
        userId,
        ty,
        stageId,
        JSON.stringify(completed),
        JSON.stringify(notes),
        JSON.stringify(data),
        now
      );
  } else {
    getDb()
      .prepare(
        `UPDATE eoy_cases SET stage_id = ?, completed_json = ?, notes_json = ?, data_json = ?, updated_at = ?
         WHERE user_id = ? AND tax_year = ?`
      )
      .run(
        stageId,
        JSON.stringify(completed),
        JSON.stringify(notes),
        JSON.stringify(data),
        now,
        userId,
        ty
      );
  }
  return getEoyCase(userId, ty);
}

/** Map product stage → optional workflow action for advanced users */
export function stageToWorkflow(stageId) {
  const map = {
    quarterly_complete: 'final_obligations',
    se_adjustments: 'se_annual',
    uk_adjustments: 'uk_annual',
    foreign_adjustments: 'fp_annual',
    other_income_losses: null, // UI offers losses + other_income
    calculation: 'calc',
    hmrc_assist: 'sa_assist_report',
    bsas: 'bsas_trigger',
    final_declaration: 'final_calc',
  };
  return map[stageId] ?? null;
}
