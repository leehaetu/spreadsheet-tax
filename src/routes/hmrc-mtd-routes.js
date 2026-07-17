/**
 * P1 / P2 / P3 HMRC MTD routes — user-restricted sandbox/production.
 */

import {
  listBusinesses,
  retrieveBusinessDetails,
  listIncomeExpenditureObligations,
  listFinalDeclarationObligations,
  createSePeriod,
  listSePeriods,
  retrieveSePeriod,
  amendSePeriod,
  createUkPropertyPeriod,
  retrieveUkPropertyPeriod,
  createForeignPropertyPeriod,
  retrieveForeignPropertyPeriod,
  triggerCalculation,
  listCalculations,
  retrieveCalculation,
  putSeAnnualSubmission,
  putUkPropertyAnnualSubmission,
  putForeignPropertyAnnualSubmission,
  triggerBsas,
  listBsas,
  retrieveBsasSelfEmployment,
  retrieveBsasUkProperty,
  retrieveBsasForeignProperty,
  submitBsasSeAdjustments,
  createBroughtForwardLoss,
  listBroughtForwardLosses,
  createTaxLiabilityAdjustment,
  retrievePeriodsOfAccount,
  createOrUpdatePeriodsOfAccount,
  retrieveItsaStatus,
  retrieveBiss,
  retrieveBalanceAndTransactions,
  createTestBusiness,
  defaultSeAnnualBody,
  periodBodyFromDraft,
  taxYearFromPeriodStart,
  mtdCapabilityMatrix,
} from '../lib/hmrc-api.js';
import { getDraft, writeAudit } from '../lib/drafts.js';

/**
 * @param {import('express').Express} app
 * @param {{
 *   requireUser: Function,
 *   getActiveConnection: Function,
 * }} deps
 */
export function registerHmrcMtdRoutes(app, deps) {
  const { requireUser, getActiveConnection } = deps;

  function requireLiveToken(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (process.env.HMRC_ALLOW_LIVE_SUBMIT !== '1') {
      res.status(403).json({
        ok: false,
        error: 'Set HMRC_ALLOW_LIVE_SUBMIT=1 for external HMRC HTTP calls.',
      });
      return null;
    }
    const conn = getActiveConnection(user.id);
    if (!conn || conn.expired || conn.mock || !conn.accessToken) {
      res.status(400).json({
        ok: false,
        error: 'Connect real HMRC OAuth first (non-mock token).',
      });
      return null;
    }
    return { user, conn };
  }

  function ninoFrom(req) {
    return String(
      req.body?.nino ||
        req.query?.nino ||
        process.env.HMRC_SANDBOX_TEST_NINO ||
        ''
    )
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  async function run(req, res, label, fn) {
    const ctx = requireLiveToken(req, res);
    if (!ctx) return;
    const nino = ninoFrom(req);
    if (!nino) {
      return res.status(400).json({ ok: false, error: 'nino required' });
    }
    try {
      const result = await fn({
        accessToken: ctx.conn.accessToken,
        nino,
        req,
        userId: ctx.user.id,
        ...pickBody(req),
      });
      writeAudit({
        userId: ctx.user.id,
        action: `hmrc_${label}`,
        entityType: 'hmrc_api',
        meta: {
          ok: result.ok,
          status: result.status,
          path: result.path,
          nino: nino.slice(0, 2) + '****',
        },
      });
      res.status(result.ok ? 200 : 502).json(result);
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        label,
      });
    }
  }

  function pickBody(req) {
    const b = req.body || {};
    return {
      businessId: b.businessId || req.query.businessId,
      taxYear: b.taxYear || req.query.taxYear,
      periodId: b.periodId || req.query.periodId,
      calculationId: b.calculationId || req.query.calculationId,
      calculationType: b.calculationType,
      typeOfBusiness: b.typeOfBusiness || req.query.typeOfBusiness,
      fromDate: b.fromDate || req.query.fromDate,
      toDate: b.toDate || req.query.toDate,
      status: b.status || req.query.status,
      body: b.body || b.payload || undefined,
      draftId: b.draftId,
      taxYearBroughtForwardFrom: b.taxYearBroughtForwardFrom,
      typeOfLoss: b.typeOfLoss,
      docNumber: b.docNumber || req.query.docNumber,
      onlyOpenItems: b.onlyOpenItems ?? req.query.onlyOpenItems,
      includeLocks: b.includeLocks ?? req.query.includeLocks,
    };
  }

  app.get('/api/hmrc/mtd/capabilities', (_req, res) => {
    res.json({ ok: true, ...mtdCapabilityMatrix() });
  });

  // ——— P1 ———
  app.get('/api/hmrc/mtd/businesses', (req, res) =>
    run(req, res, 'businesses', (o) => listBusinesses(o))
  );

  /** Sandbox only: create UK/foreign/SE test business via SA Test Support */
  app.post('/api/hmrc/mtd/test-business', (req, res) =>
    run(req, res, 'create_test_business', (o) =>
      createTestBusiness({
        ...o,
        typeOfBusiness: req.body?.typeOfBusiness || 'uk-property',
        body: req.body?.body,
      })
    )
  );
  app.get('/api/hmrc/mtd/businesses/:businessId', (req, res) =>
    run(req, res, 'business_retrieve', (o) =>
      retrieveBusinessDetails({ ...o, businessId: req.params.businessId })
    )
  );
  app.get('/api/hmrc/mtd/obligations/ie', (req, res) =>
    run(req, res, 'obligations_ie', (o) => listIncomeExpenditureObligations(o))
  );

  app.post('/api/hmrc/mtd/period/se', async (req, res) => {
    const ctx = requireLiveToken(req, res);
    if (!ctx) return;
    let body = req.body?.body || req.body?.periodBody;
    if (req.body?.draftId) {
      const draft = getDraft(String(req.body.draftId));
      body = periodBodyFromDraft(draft, 'self_employment');
      if (!body) {
        return res
          .status(404)
          .json({ ok: false, error: 'Draft missing self-employment payload' });
      }
    }
    if (!body || !req.body?.businessId) {
      return res
        .status(400)
        .json({ ok: false, error: 'businessId and body or draftId required' });
    }
    req.body = { ...req.body, body };
    return run(req, res, 'se_period_create', (o) =>
      createSePeriod({ ...o, businessId: req.body.businessId, body })
    );
  });

  app.get('/api/hmrc/mtd/period/se/:businessId', (req, res) =>
    run(req, res, 'se_period_list', (o) =>
      listSePeriods({
        ...o,
        businessId: req.params.businessId,
        taxYear: req.query.taxYear || o.taxYear || '2024-25',
      })
    )
  );

  app.get('/api/hmrc/mtd/period/se/:businessId/:periodId', (req, res) =>
    run(req, res, 'se_period_get', (o) =>
      retrieveSePeriod({
        ...o,
        businessId: req.params.businessId,
        periodId: req.params.periodId,
        taxYear: req.query.taxYear || o.taxYear,
      })
    )
  );

  app.put('/api/hmrc/mtd/period/se/:businessId/:periodId', (req, res) =>
    run(req, res, 'se_period_amend', (o) =>
      amendSePeriod({
        ...o,
        businessId: req.params.businessId,
        periodId: req.params.periodId,
        taxYear: req.body?.taxYear || o.taxYear,
        body: req.body?.body || req.body,
      })
    )
  );

  app.post('/api/hmrc/mtd/period/uk', async (req, res) => {
    const ctx = requireLiveToken(req, res);
    if (!ctx) return;
    let body = req.body?.body || req.body?.periodBody;
    if (req.body?.draftId) {
      const draft = getDraft(String(req.body.draftId));
      body = periodBodyFromDraft(draft, 'uk_property');
      if (!body) {
        return res
          .status(404)
          .json({ ok: false, error: 'Draft missing UK property payload' });
      }
    }
    const taxYear =
      req.body?.taxYear ||
      taxYearFromPeriodStart(body?.fromDate || body?.periodDates?.periodStartDate);
    if (!body || !req.body?.businessId) {
      return res
        .status(400)
        .json({ ok: false, error: 'businessId and body or draftId required' });
    }
    return run(req, res, 'uk_period_create', (o) =>
      createUkPropertyPeriod({
        ...o,
        businessId: req.body.businessId,
        taxYear,
        body,
      })
    );
  });

  app.get(
    '/api/hmrc/mtd/period/uk/:businessId/:taxYear/:periodId',
    (req, res) =>
      run(req, res, 'uk_period_get', (o) =>
        retrieveUkPropertyPeriod({
          ...o,
          businessId: req.params.businessId,
          taxYear: req.params.taxYear,
          periodId: req.params.periodId,
        })
      )
  );

  app.post('/api/hmrc/mtd/period/foreign', async (req, res) => {
    let body = req.body?.body || req.body?.periodBody;
    if (req.body?.draftId) {
      const draft = getDraft(String(req.body.draftId));
      body = periodBodyFromDraft(draft, 'foreign_property');
      if (!body) {
        return res
          .status(404)
          .json({ ok: false, error: 'Draft missing foreign property payload' });
      }
    }
    const taxYear =
      req.body?.taxYear ||
      taxYearFromPeriodStart(body?.fromDate || body?.periodDates?.periodStartDate);
    if (!body || !req.body?.businessId) {
      return res
        .status(400)
        .json({ ok: false, error: 'businessId and body or draftId required' });
    }
    return run(req, res, 'fp_period_create', (o) =>
      createForeignPropertyPeriod({
        ...o,
        businessId: req.body.businessId,
        taxYear,
        body,
      })
    );
  });

  app.get(
    '/api/hmrc/mtd/period/foreign/:businessId/:taxYear/:periodId',
    (req, res) =>
      run(req, res, 'fp_period_get', (o) =>
        retrieveForeignPropertyPeriod({
          ...o,
          businessId: req.params.businessId,
          taxYear: req.params.taxYear,
          periodId: req.params.periodId,
        })
      )
  );

  app.post('/api/hmrc/mtd/calculations/trigger', (req, res) =>
    run(req, res, 'calc_trigger', (o) =>
      triggerCalculation({
        ...o,
        taxYear: req.body?.taxYear || o.taxYear,
        calculationType: req.body?.calculationType || 'in-year',
        body: req.body?.body || {},
      })
    )
  );
  app.get('/api/hmrc/mtd/calculations', (req, res) =>
    run(req, res, 'calc_list', (o) =>
      listCalculations({ ...o, taxYear: req.query.taxYear || o.taxYear })
    )
  );
  app.get('/api/hmrc/mtd/calculations/:taxYear/:calculationId', (req, res) =>
    run(req, res, 'calc_get', (o) =>
      retrieveCalculation({
        ...o,
        taxYear: req.params.taxYear,
        calculationId: req.params.calculationId,
      })
    )
  );

  // ——— P2 ———
  app.get('/api/hmrc/mtd/obligations/final-declaration', (req, res) =>
    run(req, res, 'obligations_crystallisation', (o) =>
      listFinalDeclarationObligations(o)
    )
  );

  app.put('/api/hmrc/mtd/annual/se', (req, res) =>
    run(req, res, 'se_annual', (o) =>
      putSeAnnualSubmission({
        ...o,
        businessId: req.body.businessId,
        taxYear: req.body.taxYear,
        body: req.body.body || req.body.payload || defaultSeAnnualBody(),
      })
    )
  );
  app.put('/api/hmrc/mtd/annual/uk', (req, res) =>
    run(req, res, 'uk_annual', (o) =>
      putUkPropertyAnnualSubmission({
        ...o,
        businessId: req.body.businessId,
        taxYear: req.body.taxYear,
        body: req.body.body || req.body.payload,
      })
    )
  );
  app.put('/api/hmrc/mtd/annual/foreign', (req, res) =>
    run(req, res, 'fp_annual', (o) =>
      putForeignPropertyAnnualSubmission({
        ...o,
        businessId: req.body.businessId,
        taxYear: req.body.taxYear,
        body: req.body.body || req.body.payload,
      })
    )
  );

  app.post('/api/hmrc/mtd/bsas/trigger', (req, res) =>
    run(req, res, 'bsas_trigger', (o) =>
      triggerBsas({ ...o, body: req.body.body || req.body })
    )
  );
  app.get('/api/hmrc/mtd/bsas', (req, res) =>
    run(req, res, 'bsas_list', (o) => listBsas(o))
  );
  app.get('/api/hmrc/mtd/bsas/se/:calculationId', (req, res) =>
    run(req, res, 'bsas_se', (o) =>
      retrieveBsasSelfEmployment({
        ...o,
        calculationId: req.params.calculationId,
      })
    )
  );
  app.get('/api/hmrc/mtd/bsas/uk/:calculationId', (req, res) =>
    run(req, res, 'bsas_uk', (o) =>
      retrieveBsasUkProperty({
        ...o,
        calculationId: req.params.calculationId,
      })
    )
  );
  app.get('/api/hmrc/mtd/bsas/foreign/:calculationId', (req, res) =>
    run(req, res, 'bsas_fp', (o) =>
      retrieveBsasForeignProperty({
        ...o,
        calculationId: req.params.calculationId,
      })
    )
  );
  app.post('/api/hmrc/mtd/bsas/se/:calculationId/adjust', (req, res) =>
    run(req, res, 'bsas_adjust_se', (o) =>
      submitBsasSeAdjustments({
        ...o,
        calculationId: req.params.calculationId,
        body: req.body.body || req.body,
      })
    )
  );

  app.post('/api/hmrc/mtd/losses/brought-forward', (req, res) =>
    run(req, res, 'loss_create', (o) =>
      createBroughtForwardLoss({ ...o, body: req.body.body || req.body })
    )
  );
  app.get('/api/hmrc/mtd/losses/brought-forward', (req, res) =>
    run(req, res, 'loss_list', (o) => listBroughtForwardLosses(o))
  );

  app.post('/api/hmrc/mtd/tax-liability-adjustments', (req, res) =>
    run(req, res, 'tla', (o) =>
      createTaxLiabilityAdjustment({
        ...o,
        taxYear: req.body.taxYear,
        body: req.body.body || req.body,
      })
    )
  );

  app.get('/api/hmrc/mtd/periods-of-account/:businessId/:taxYear', (req, res) =>
    run(req, res, 'poa_get', (o) =>
      retrievePeriodsOfAccount({
        ...o,
        businessId: req.params.businessId,
        taxYear: req.params.taxYear,
      })
    )
  );
  app.put('/api/hmrc/mtd/periods-of-account/:businessId/:taxYear', (req, res) =>
    run(req, res, 'poa_put', (o) =>
      createOrUpdatePeriodsOfAccount({
        ...o,
        businessId: req.params.businessId,
        taxYear: req.params.taxYear,
        body: req.body.body || req.body,
      })
    )
  );

  // Final declaration calculation types (intent-to-finalise etc.)
  app.post('/api/hmrc/mtd/calculations/final', (req, res) =>
    run(req, res, 'calc_final', (o) =>
      triggerCalculation({
        ...o,
        taxYear: req.body?.taxYear,
        calculationType: req.body?.calculationType || 'intent-to-finalise',
        body: req.body?.body || {},
      })
    )
  );

  // ——— P3 ———
  app.get('/api/hmrc/mtd/itsa-status', (req, res) =>
    run(req, res, 'itsa_status', (o) =>
      retrieveItsaStatus({
        ...o,
        taxYear: req.query.taxYear || req.body?.taxYear || '2024-25',
      })
    )
  );
  app.get('/api/hmrc/mtd/biss', (req, res) =>
    run(req, res, 'biss', (o) =>
      retrieveBiss({
        ...o,
        businessId: req.query.businessId || o.businessId,
        taxYear: req.query.taxYear || o.taxYear || '2024-25',
        typeOfBusiness: req.query.typeOfBusiness || 'self-employment',
      })
    )
  );
  app.get('/api/hmrc/mtd/accounts/balance', (req, res) =>
    run(req, res, 'accounts_balance', (o) => retrieveBalanceAndTransactions(o))
  );
}
