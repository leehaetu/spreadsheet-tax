/**
 * Sandbox helper: create UK/foreign property test businesses, or use existing
 * when HMRC returns RULE_PROPERTY_BUSINESS_ADDED.
 *
 * Never score a 400 create as success unless Business Details later yields an ID.
 */

import { createTestBusiness, listBusinesses } from './hmrc-api.js';

/**
 * @param {object} biz
 */
function classifyBusiness(biz) {
  const id = String(biz.businessId || biz.id || '');
  const t = String(biz.typeOfBusiness || biz.type || '').toLowerCase();
  let kind = 'other';
  if (t.includes('self') || t === 'self-employment') kind = 'se';
  else if (t.includes('foreign')) kind = 'foreign';
  else if (t.includes('uk') || t.includes('property')) kind = 'uk';
  return { id, type: t, kind };
}

/**
 * @param {{
 *   accessToken: string,
 *   nino: string,
 *   req?: import('express').Request|null,
 *   userId?: string|null,
 * }} opts
 */
export async function ensurePropertyBusinesses(opts) {
  /** @type {{ steps: object[], uk: string, foreign: string, se: string }} */
  const out = {
    steps: [],
    uk: '',
    foreign: '',
    se: '',
  };

  for (const typeOfBusiness of /** @type {const} */ ([
    'uk-property',
    'foreign-property',
  ])) {
    const created = await createTestBusiness({
      ...opts,
      typeOfBusiness,
    });
    const code =
      created?.body?.code ||
      created?.body?.errors?.[0]?.code ||
      null;
    const businessId =
      created?.body?.businessId ||
      created?.response?.businessId ||
      null;
    const already =
      created?.status === 400 && code === 'RULE_PROPERTY_BUSINESS_ADDED';
    out.steps.push({
      step: `create_${typeOfBusiness}`,
      ok: Boolean(businessId), // create success only with new ID
      alreadyAdded: already,
      status: created?.status,
      hmrcCode: code,
      businessId: businessId || null,
    });
    if (typeOfBusiness === 'uk-property' && businessId) out.uk = businessId;
    if (typeOfBusiness === 'foreign-property' && businessId) out.foreign = businessId;
  }

  const listed = await listBusinesses(opts);
  out.steps.push({
    step: 'list_businesses',
    ok: listed?.status >= 200 && listed?.status < 300,
    status: listed?.status,
    body: listed?.body,
  });

  const list =
    listed?.body?.listOfBusinesses ||
    listed?.body?.businesses ||
    [];
  for (const row of Array.isArray(list) ? list : []) {
    const { id, kind } = classifyBusiness(row);
    if (!id) continue;
    if (kind === 'se' && !out.se) out.se = id;
    if (kind === 'uk' && !out.uk) out.uk = id;
    if (kind === 'foreign' && !out.foreign) out.foreign = id;
  }

  return {
    ...out,
    ok: Boolean(out.uk && out.foreign),
    note: out.ok
      ? 'UK and foreign property business IDs resolved (create or existing list)'
      : 'Missing UK and/or foreign property business ID after create+list',
  };
}
