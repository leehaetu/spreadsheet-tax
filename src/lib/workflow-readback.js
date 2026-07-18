/**
 * Post-success HMRC readback for product workflows.
 * Only sets attempted:true when a real retrieve/list HTTP call is made.
 */

import * as hmrcApi from './hmrc-api.js';
import { summariseHmrcResult } from './workflow-receipts.js';

/**
 * @param {{
 *   workflow: string,
 *   hmrcResult: object|null,
 *   o: object,
 *   body: object,
 *   taxYear: string,
 * }} ctx
 * @param {Partial<typeof hmrcApi>} [deps] — inject for unit tests; production uses real hmrc-api
 * @returns {Promise<{ attempted: boolean, ok?: boolean, hmrcStatus?: number|null, hmrcCode?: string|null, path?: string|null, body?: unknown, note?: string }>}
 */
export async function performWorkflowReadback(ctx, deps = {}) {
  const api = { ...hmrcApi, ...deps };
  const { workflow, hmrcResult, o, body, taxYear } = ctx;
  const bidSe = body?.businessIdSe;
  const bidUk = body?.businessIdUk;
  const bidFp = body?.businessIdForeign;
  const periodId =
    body?.periodId ||
    hmrcResult?.body?.periodId ||
    null;
  const calculationId =
    body?.calculationId ||
    body?.bsasCalculationId ||
    hmrcResult?.body?.calculationId ||
    null;

  try {
    switch (workflow) {
      case 'se_period':
      case 'se_amend': {
        if (!bidSe || !periodId) {
          return {
            attempted: false,
            note: 'SE period readback needs businessIdSe and periodId',
          };
        }
        const ty =
          taxYear || api.taxYearFromPeriodId(periodId) || '2024-25';
        const r = await api.retrieveSePeriod({
          ...o,
          businessId: bidSe,
          periodId,
          taxYear: ty,
        });
        return pack(r, 'se_period_retrieve');
      }
      case 'uk_period':
      case 'uk_amend': {
        const subId =
          periodId ||
          hmrcResult?.body?.submissionId ||
          hmrcResult?.body?.periodId;
        if (!bidUk || !subId) {
          return {
            attempted: false,
            note: 'UK period readback needs businessIdUk and submission/period id',
          };
        }
        const r = await api.retrieveUkPropertyPeriod({
          ...o,
          businessId: bidUk,
          taxYear,
          periodId: subId,
        });
        return pack(r, 'uk_property_period_retrieve');
      }
      case 'fp_period':
      case 'fp_amend': {
        const subId =
          periodId ||
          hmrcResult?.body?.submissionId ||
          hmrcResult?.body?.periodId;
        if (!bidFp || !subId) {
          return {
            attempted: false,
            note: 'Foreign period readback needs businessIdForeign and submission/period id',
          };
        }
        const r = await api.retrieveForeignPropertyPeriod({
          ...o,
          businessId: bidFp,
          taxYear,
          periodId: subId,
        });
        return pack(r, 'foreign_property_period_retrieve');
      }
      case 'calc':
      case 'final_calc': {
        if (calculationId) {
          const r = await api.retrieveCalculation({
            ...o,
            taxYear,
            calculationId,
          });
          return pack(r, 'calculations_retrieve');
        }
        const r = await api.listCalculations({ ...o, taxYear });
        return pack(r, 'calculations_list');
      }
      case 'calc_list':
        // Already a list — no second call
        return {
          attempted: false,
          note: 'calc_list response is already the list readback',
        };
      case 'sa_assist_report':
        return {
          attempted: false,
          note: 'SA Assist report response is already the customer message payload (or 204 empty)',
        };
      case 'sa_assist_acknowledge':
        return {
          attempted: false,
          note: 'SA Assist acknowledge is a 204 acknowledgement with no further readback',
        };
      case 'bsas_trigger':
      case 'bsas_adjust': {
        if (calculationId) {
          const r = await api.retrieveBsasSelfEmployment({
            ...o,
            calculationId,
          });
          return pack(r, 'bsas_retrieve_se');
        }
        const r = await api.listBsas({ ...o, taxYear });
        return pack(r, 'bsas_list');
      }
      case 'bsas_adjust_uk': {
        if (calculationId && api.retrieveBsasUkProperty) {
          const r = await api.retrieveBsasUkProperty({
            ...o,
            calculationId,
          });
          return pack(r, 'bsas_retrieve_uk');
        }
        return {
          attempted: false,
          note: 'bsas_adjust_uk needs calculationId for UK retrieve',
        };
      }
      case 'bsas_adjust_fp': {
        if (calculationId && api.retrieveBsasForeignProperty) {
          const r = await api.retrieveBsasForeignProperty({
            ...o,
            calculationId,
          });
          return pack(r, 'bsas_retrieve_foreign');
        }
        return {
          attempted: false,
          note: 'bsas_adjust_fp needs calculationId for foreign retrieve',
        };
      }
      case 'periods_of_account':
      case 'periods_of_account_put': {
        const bid = bidSe || bidUk || bidFp || body?.businessId;
        if (!bid) {
          return {
            attempted: false,
            note: 'periods_of_account readback needs businessId',
          };
        }
        if (workflow === 'periods_of_account') {
          return {
            attempted: false,
            note: 'periods_of_account response is already the retrieve',
          };
        }
        const r = await api.retrievePeriodsOfAccount({
          ...o,
          businessId: bid,
          taxYear,
        });
        return pack(r, 'bd_periods_of_account');
      }
      case 'losses': {
        if (api.listBroughtForwardLosses) {
          const r = await api.listBroughtForwardLosses({
            ...o,
            taxYearBroughtForwardFrom: taxYear,
            businessId: bidSe,
          });
          return pack(r, 'losses_bf_list');
        }
        return {
          attempted: false,
          note: 'losses: list retrieve not available',
        };
      }
      case 'bsas_list':
        return {
          attempted: false,
          note: 'bsas_list response is already the list readback',
        };
      case 'final_obligations':
        return {
          attempted: false,
          note: 'final_obligations response is already the obligations readback',
        };
      case 'se_annual':
      case 'uk_annual':
      case 'fp_annual':
      case 'other_income':
        return {
          attempted: false,
          note: `${workflow}: no HMRC retrieve endpoint called after write — request/response stored on receipt`,
        };
      default:
        return {
          attempted: false,
          note: `No readback mapped for workflow ${workflow}`,
        };
    }
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      note: e instanceof Error ? e.message : 'readback failed',
    };
  }
}

/**
 * @param {object} result hmrcFetch result
 * @param {string} label
 */
function pack(result, label) {
  const s = summariseHmrcResult(result);
  return {
    attempted: true,
    label,
    ok: s.ok,
    hmrcStatus: s.hmrcStatus,
    hmrcCode: s.hmrcCode,
    path: s.path,
    body: result?.body ?? null,
  };
}
