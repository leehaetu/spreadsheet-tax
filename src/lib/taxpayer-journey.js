/**
 * Unified taxpayer journey: SE + UK property + foreign property.
 * One product that adapts to income sources — not separate apps.
 */

import { getDb } from './db.js';
import { newId } from './auth.js';

export const MANAGE_MODES = ['self', 'accountant', 'together'];
export const SOURCE_TYPES = [
  'self_employment',
  'uk_property',
  'foreign_property',
];

/**
 * @param {string} userId
 */
export function getTaxpayerProfile(userId) {
  const row = getDb()
    .prepare(`SELECT * FROM taxpayer_profiles WHERE user_id = ?`)
    .get(userId);
  if (!row) {
    return {
      userId,
      manageMode: 'self',
      taxYear: defaultTaxYear(),
      periodType: 'standard',
      onboardingComplete: false,
      meta: {},
    };
  }
  return {
    userId: row.user_id,
    manageMode: row.manage_mode,
    taxYear: row.tax_year || defaultTaxYear(),
    periodType: row.period_type || 'standard',
    onboardingComplete: Boolean(row.onboarding_complete),
    meta: row.meta_json ? JSON.parse(row.meta_json) : {},
    updatedAt: row.updated_at,
  };
}

/**
 * @param {string} userId
 * @param {object} patch
 */
export function saveTaxpayerProfile(userId, patch) {
  const cur = getTaxpayerProfile(userId);
  const next = {
    manageMode: patch.manageMode || cur.manageMode,
    taxYear: patch.taxYear || cur.taxYear,
    periodType: patch.periodType || cur.periodType,
    onboardingComplete:
      patch.onboardingComplete != null
        ? Boolean(patch.onboardingComplete)
        : cur.onboardingComplete,
    meta: { ...cur.meta, ...(patch.meta || {}) },
  };
  if (patch.manageMode && !MANAGE_MODES.includes(patch.manageMode)) {
    return { error: 'Invalid manageMode', status: 400 };
  }
  const now = new Date().toISOString();
  const exists = getDb()
    .prepare(`SELECT 1 FROM taxpayer_profiles WHERE user_id = ?`)
    .get(userId);
  if (!exists) {
    getDb()
      .prepare(
        `INSERT INTO taxpayer_profiles (user_id, manage_mode, tax_year, period_type, onboarding_complete, meta_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        next.manageMode,
        next.taxYear,
        next.periodType,
        next.onboardingComplete ? 1 : 0,
        JSON.stringify(next.meta),
        now
      );
  } else {
    getDb()
      .prepare(
        `UPDATE taxpayer_profiles SET manage_mode=?, tax_year=?, period_type=?, onboarding_complete=?, meta_json=?, updated_at=?
         WHERE user_id=?`
      )
      .run(
        next.manageMode,
        next.taxYear,
        next.periodType,
        next.onboardingComplete ? 1 : 0,
        JSON.stringify(next.meta),
        now,
        userId
      );
  }
  return { ok: true, profile: getTaxpayerProfile(userId) };
}

/**
 * @param {string} userId
 */
export function listIncomeSources(userId) {
  return getDb()
    .prepare(
      `SELECT * FROM income_sources WHERE user_id = ? ORDER BY type, label`
    )
    .all(userId)
    .map(hydrateSource);
}

/**
 * Replace or upsert sources from HMRC business list + user nicknames.
 * @param {string} userId
 * @param {Array<object>} sources
 */
export function setIncomeSources(userId, sources) {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare(`DELETE FROM income_sources WHERE user_id = ?`).run(userId);
  const ins = database.prepare(
    `INSERT INTO income_sources (
      id, user_id, type, business_id, label, nickname, country_code, joint, ownership_share,
      spreadsheet_hint, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of sources || []) {
    const type = s.type || 'self_employment';
    if (!SOURCE_TYPES.includes(type)) continue;
    ins.run(
      s.id || newId(),
      userId,
      type,
      s.businessId || null,
      s.label || type,
      s.nickname || null,
      s.countryCode || null,
      s.joint ? 1 : 0,
      s.ownershipShare != null ? Number(s.ownershipShare) : null,
      s.spreadsheetHint || null,
      s.status || 'active',
      now,
      now
    );
  }
  return listIncomeSources(userId);
}

/**
 * Map HMRC listOfBusinesses into income source drafts (user confirms).
 * @param {Array<object>} businesses
 */
export function mapHmrcBusinessesToSources(businesses) {
  return (businesses || []).map((b) => {
    const t = String(b.typeOfBusiness || b.type || '').toLowerCase();
    let type = 'self_employment';
    if (t.includes('uk') && t.includes('property')) type = 'uk_property';
    else if (t.includes('foreign') && t.includes('property'))
      type = 'foreign_property';
    else if (t.includes('self')) type = 'self_employment';
    return {
      type,
      businessId: b.businessId || b.id || null,
      label: b.tradingName || b.trading_name || type.replace(/_/g, ' '),
      nickname: b.tradingName || null,
      status: 'active',
    };
  });
}

/**
 * Build dashboard payload for taxpayer home.
 * @param {string} userId
 * @param {{ obligations?: object, businesses?: object[] }} [hmrc]
 */
export function buildDashboard(userId, hmrc = {}) {
  const profile = getTaxpayerProfile(userId);
  const sources = listIncomeSources(userId);
  const nextDeadline = extractNextDeadline(hmrc.obligations);
  const sourceCards = sources.map((s) => ({
    ...s,
    readiness: s.spreadsheetHint ? 'ready_to_review' : 'spreadsheet_needed',
  }));
  const ready = sourceCards.filter((s) => s.readiness === 'ready_to_review')
    .length;
  const total = sourceCards.length || 0;
  return {
    profile,
    sources: sourceCards,
    taxYear: profile.taxYear,
    nextDeadline,
    nextTask:
      total === 0
        ? {
            title: 'Finish setup',
            detail: 'Confirm your income sources and connect a spreadsheet.',
            href: '/onboarding',
          }
        : {
            title: nextDeadline
              ? `Check and send your update to ${nextDeadline.periodEnd || nextDeadline.due}`
              : 'Prepare this quarter’s update',
            detail:
              total > 0
                ? `${ready} of ${total} income source${total === 1 ? '' : 's'} ready`
                : 'Add income sources',
            href: '/app?flow=quarterly',
          },
    nav: taxpayerNav(),
  };
}

export function taxpayerNav() {
  return [
    { href: '/home', label: 'Home' },
    { href: '/records', label: 'Records' },
    { href: '/app?flow=quarterly', label: 'Quarterly updates' },
    { href: '/year-end', label: 'Tax return' },
    { href: '/history', label: 'Messages' },
    { href: '/account', label: 'Settings' },
  ];
}

/**
 * Cumulative review rows from draft payloads vs previous snapshot.
 * @param {object} payloads
 * @param {object|null} previousCumulative
 */
export function buildCumulativeReview(payloads, previousCumulative = null) {
  const prev = previousCumulative || {};
  /** @type {Array<{source: string, rows: Array<object>}>} */
  const sections = [];

  if (payloads?.selfEmployment) {
    const se = payloads.selfEmployment;
    const turnover = num(se.periodIncome?.turnover);
    const other = num(se.periodIncome?.other);
    const expenses = flattenExpenses(se.periodExpenses);
    const rows = [
      line('Turnover / sales', turnover, prev.se_turnover),
      line('Other income', other, prev.se_other),
      ...expenses.map((e) =>
        line(e.label, e.amount, prev[`se_exp_${e.key}`])
      ),
    ];
    sections.push({
      source: 'self_employment',
      title: 'Self-employment',
      rows,
      totals: {
        income: turnover + other,
        expenses: expenses.reduce((a, e) => a + e.amount, 0),
      },
    });
  }

  if (payloads?.ukProperty?.ukOtherProperty || payloads?.ukProperty) {
    const uk =
      payloads.ukProperty?.ukOtherProperty ||
      payloads.ukProperty?.ukNonFhlProperty ||
      {};
    const rent = num(uk.income?.periodAmount ?? uk.income?.rentIncome);
    const other = num(uk.income?.otherIncome);
    const rows = [
      line('Rental income', rent, prev.uk_rent),
      line('Other income', other, prev.uk_other),
    ];
    sections.push({
      source: 'uk_property',
      title: 'UK property',
      rows,
      totals: { income: rent + other },
    });
  }

  const fpList =
    payloads?.foreignProperty?.foreignProperty ||
    payloads?.foreignProperty?.foreignNonFhlProperty ||
    [];
  if (Array.isArray(fpList) && fpList.length) {
    const rows = [];
    for (const fp of fpList) {
      const country = fp.countryCode || '??';
      const rent = num(fp.income?.rentIncome?.rentAmount ?? fp.income?.rentAmount);
      rows.push(
        line(`Rent (${country})`, rent, prev[`fp_${country}_rent`], {
          country,
          note: 'Confirm exchange rate if source file is not GBP — never invent rates.',
        })
      );
    }
    sections.push({
      source: 'foreign_property',
      title: 'Foreign property',
      rows,
      totals: {
        income: rows.reduce((a, r) => a + (r.thisQuarter || 0), 0),
      },
    });
  }

  return {
    periodStart: payloads?.meta?.periodStartDate || null,
    periodEnd: payloads?.meta?.periodEndDate || null,
    taxYear: payloads?.meta?.taxYear || null,
    sections,
    note: 'HMRC updates are cumulative from the start of the tax year through this period end — not only the last three months.',
  };
}

/**
 * Snapshot cumulative for next comparison.
 * @param {string} userId
 * @param {object} payloads
 * @param {object} [opts]
 */
export function savePeriodSnapshot(userId, payloads, opts = {}) {
  const review = buildCumulativeReview(payloads, opts.previousCumulative);
  const cumulative = {};
  for (const sec of review.sections) {
    for (const r of sec.rows) {
      cumulative[r.key] = r.yearToDate;
    }
  }
  const id = newId();
  getDb()
    .prepare(
      `INSERT INTO period_snapshots (
        id, user_id, source_id, tax_year, period_end, this_quarter_json, cumulative_json,
        previous_cumulative_json, draft_id, attempt_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      opts.sourceId || null,
      review.taxYear || defaultTaxYear(),
      review.periodEnd || '',
      JSON.stringify(review),
      JSON.stringify(cumulative),
      JSON.stringify(opts.previousCumulative || {}),
      opts.draftId || null,
      opts.attemptId || null,
      new Date().toISOString()
    );
  return { id, cumulative, review };
}

/**
 * @param {string} userId
 * @param {string} [taxYear]
 */
export function latestCumulative(userId, taxYear) {
  const ty = taxYear || defaultTaxYear();
  const row = getDb()
    .prepare(
      `SELECT * FROM period_snapshots WHERE user_id = ? AND tax_year = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId, ty);
  if (!row) return null;
  return {
    cumulative: JSON.parse(row.cumulative_json || '{}'),
    review: JSON.parse(row.this_quarter_json || '{}'),
    periodEnd: row.period_end,
  };
}

/**
 * Nil (zero activity) payload skeleton.
 * @param {string} type
 * @param {object} meta
 */
export function buildNilPayload(type, meta) {
  const base = {
    meta: {
      taxYear: meta.taxYear || defaultTaxYear(),
      periodStartDate: meta.periodStartDate,
      periodEndDate: meta.periodEndDate,
    },
  };
  if (type === 'self_employment') {
    return {
      ...base,
      selfEmployment: {
        periodDates: {
          periodStartDate: meta.periodStartDate,
          periodEndDate: meta.periodEndDate,
        },
        periodIncome: { turnover: 0, other: 0 },
        periodExpenses: { consolidatedExpenses: 0 },
      },
    };
  }
  if (type === 'uk_property') {
    return {
      ...base,
      ukProperty: {
        fromDate: meta.periodStartDate,
        toDate: meta.periodEndDate,
        ukOtherProperty: {
          income: { periodAmount: 0, otherIncome: 0 },
          expenses: { consolidatedExpenses: 0 },
        },
      },
    };
  }
  return {
    ...base,
    foreignProperty: {
      fromDate: meta.periodStartDate,
      toDate: meta.periodEndDate,
      foreignProperty: [
        {
          countryCode: meta.countryCode || 'ESP',
          income: {
            rentIncome: { rentAmount: 0 },
            foreignTaxCreditRelief: false,
          },
          expenses: { consolidatedExpenses: 0 },
        },
      ],
    },
  };
}

export function defaultTaxYear() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  // UK tax year starts 6 April
  if (m > 4 || (m === 4 && d.getUTCDate() >= 6)) {
    return `${y}-${String(y + 1).slice(2)}`;
  }
  return `${y - 1}-${String(y).slice(2)}`;
}

function hydrateSource(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    businessId: row.business_id,
    label: row.label,
    nickname: row.nickname,
    countryCode: row.country_code,
    joint: Boolean(row.joint),
    ownershipShare: row.ownership_share,
    spreadsheetHint: row.spreadsheet_hint,
    status: row.status,
  };
}

function extractNextDeadline(obligationsBody) {
  if (!obligationsBody) return null;
  const obligations =
    obligationsBody.obligations ||
    obligationsBody.obligationDetails ||
    [];
  let best = null;
  for (const g of Array.isArray(obligations) ? obligations : []) {
    const periods = g.obligationDetails || g.obligations || [g];
    for (const p of periods) {
      if (String(p.status || '').toLowerCase() === 'fulfilled') continue;
      const due = p.dueDate || p.due;
      if (!due) continue;
      if (!best || due < best.due) {
        best = {
          due,
          periodStart: p.periodStartDate || p.fromDate,
          periodEnd: p.periodEndDate || p.toDate,
          businessId: g.businessId || p.businessId,
          type: g.typeOfBusiness,
        };
      }
    }
  }
  return best;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function line(label, thisQuarter, previous, extra = {}) {
  const prev = num(previous);
  const q = num(thisQuarter);
  const key =
    extra.key ||
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  return {
    key,
    label,
    thisQuarter: q,
    previouslyRecorded: prev,
    yearToDate: prev + q,
    ...extra,
  };
}

function flattenExpenses(periodExpenses) {
  if (!periodExpenses || typeof periodExpenses !== 'object') return [];
  const out = [];
  for (const [k, v] of Object.entries(periodExpenses)) {
    if (v == null) continue;
    if (typeof v === 'object' && v.amount != null) {
      out.push({ key: k, label: k, amount: num(v.amount) });
    } else if (typeof v === 'number' || typeof v === 'string') {
      out.push({ key: k, label: k, amount: num(v) });
    }
  }
  return out;
}

/** Practice client workflow states from design (full pipeline) */
export const PRACTICE_CLIENT_STATES = [
  'not_started',
  'awaiting_records',
  'records_received',
  'processing',
  'needs_mapping',
  'mapping_required',
  'needs_review',
  'client_query',
  'ready_for_preparation',
  'awaiting_reviewer',
  'ready_for_approval',
  'awaiting_client_approval',
  'ready_to_submit',
  'queued',
  'submitted',
  'hmrc_rejected',
  'rejected',
  'correction_required',
  'year_complete',
];
