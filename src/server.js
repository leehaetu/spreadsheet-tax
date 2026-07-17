/**
 * Spreadsheet Tax — sales site, bridging app, practice portals, client portal.
 * Intellectual property: Lee Hine (see LICENSE).
 */

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { processLocalFile } from './lib/pipeline.js';
import { createHmrcClient } from './lib/hmrc-client.js';
import {
  listClientsForFirm,
  getClient,
  listFirms,
  listAccountants,
  ensureDemoData,
} from './lib/practice-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');

const TEMPLATE_NAME = 'period-summary-template.csv';
const templatePath = path.join(templatesDir, TEMPLATE_NAME);

ensureDemoData();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only CSV or Excel files are accepted'), ok);
  },
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

/**
 * Explicit template download — reliable Content-Disposition + Content-Type.
 * Prefer this over static mount alone (which can fail on some hosts/browsers).
 */
function sendTemplateDownload(req, res) {
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({
      error: 'Template file not found on server',
      path: TEMPLATE_NAME,
    });
  }
  const body = fs.readFileSync(templatePath);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${TEMPLATE_NAME}"`
  );
  res.setHeader('Content-Length', String(body.length));
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(body);
}

app.get('/download/template', sendTemplateDownload);
app.get('/templates/period-summary-template.csv', sendTemplateDownload);
app.get('/api/template', sendTemplateDownload);

// Static fallback for any other template files
app.use('/templates', express.static(templatesDir));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'spreadsheet-tax',
    bridging: true,
    portals: ['accountant', 'practice', 'client'],
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'sales.html'));
});

app.get('/app', (_req, res) => {
  res.sendFile(path.join(publicDir, 'app.html'));
});

app.get('/accountant', (_req, res) => {
  res.sendFile(path.join(publicDir, 'accountant.html'));
});

app.get('/practice', (_req, res) => {
  res.sendFile(path.join(publicDir, 'practice.html'));
});

app.get('/portal', (_req, res) => {
  res.sendFile(path.join(publicDir, 'portal.html'));
});

app.get('/license', (_req, res) => {
  res.sendFile(path.join(publicDir, 'license.html'));
});

app.get('/legal', (_req, res) => {
  res.sendFile(path.join(publicDir, 'legal.html'));
});

/**
 * Upload local spreadsheet → parse → map → quarterly payloads (preview).
 */
app.post('/api/import', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'No file uploaded. Use form field "file".' });
      }
      const result = processLocalFile(req.file.buffer, req.file.originalname);
      const hasAny =
        result.mapped.selfEmployment ||
        result.mapped.ukProperty ||
        result.mapped.foreignProperty.length > 0;

      if (!hasAny) {
        return res.status(422).json({
          error:
            'No self-employment, UK property, or foreign property figures found. Check the template sections.',
          rowCount: result.rowCount,
        });
      }

      res.json({
        ok: true,
        filename: req.file.originalname,
        rowCount: result.rowCount,
        metadata: result.mapped.metadata,
        sources: {
          selfEmployment: Boolean(result.mapped.selfEmployment),
          ukProperty: Boolean(result.mapped.ukProperty),
          foreignProperty: result.mapped.foreignProperty.map(
            (f) => f.countryCode
          ),
        },
        figures: {
          selfEmployment: result.mapped.selfEmployment?.figures ?? null,
          ukProperty: result.mapped.ukProperty?.figures ?? null,
          foreignProperty: result.mapped.foreignProperty.map((f) => ({
            countryCode: f.countryCode,
            figures: f.figures,
          })),
        },
        fieldLinks: result.payloads.linkIndex,
        payloads: {
          meta: result.payloads.meta,
          selfEmployment: result.payloads.selfEmployment,
          ukProperty: result.payloads.ukProperty,
          foreignProperty: result.payloads.foreignProperty,
        },
      });
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ error: e instanceof Error ? e.message : 'Import failed' });
    }
  });
});

app.post('/api/submit', async (req, res) => {
  try {
    const {
      payloads,
      nino,
      businessIdSe,
      businessIdUk,
      businessIdForeign,
      taxYear,
    } = req.body || {};
    if (!payloads) {
      return res
        .status(400)
        .json({ error: 'Missing payloads object from import preview' });
    }

    const client = createHmrcClient();
    const results = await client.submitBundle(payloads, {
      nino,
      businessIdSe,
      businessIdUk,
      businessIdForeign,
      taxYear,
    });

    res.json({
      ok: results.every((r) => r.ok),
      mode: client.mode,
      results,
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Submit failed' });
  }
});

app.get('/api/status', (_req, res) => {
  const client = createHmrcClient();
  res.json({
    ok: true,
    hmrcMode: client.mode,
    product: 'HMRC MTD ITSA bridging-only',
    supported: ['self_employment', 'uk_property', 'foreign_property'],
    recordsStayLocal: true,
    audiences: [
      'self_employed',
      'landlords',
      'bookkeepers',
      'accountants',
      'practices',
      'clients',
    ],
  });
});

/** Practice / accountant / client portal APIs (demo store) */
app.get('/api/firms', (_req, res) => {
  res.json({ ok: true, firms: listFirms() });
});

app.get('/api/accountants', (req, res) => {
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : null;
  res.json({ ok: true, accountants: listAccountants(firmId) });
});

app.get('/api/clients', (req, res) => {
  const firmId = typeof req.query.firmId === 'string' ? req.query.firmId : null;
  const accountantId =
    typeof req.query.accountantId === 'string' ? req.query.accountantId : null;
  res.json({
    ok: true,
    clients: listClientsForFirm({ firmId, accountantId }),
  });
});

app.get('/api/clients/:clientId', (req, res) => {
  const client = getClient(req.params.clientId);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({ ok: true, client });
});

if (!fs.existsSync(templatePath)) {
  console.warn('Warning: template CSV missing at', templatePath);
}

const port = Number(process.env.PORT) || 3000;

// Allow importing app without listening (tests)
if (process.env.SPREADSHEET_TAX_NO_LISTEN !== '1') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Spreadsheet Tax listening on http://0.0.0.0:${port}`);
    console.log(`  Sales:      http://localhost:${port}/`);
    console.log(`  App:        http://localhost:${port}/app`);
    console.log(`  Accountant: http://localhost:${port}/accountant`);
    console.log(`  Practice:   http://localhost:${port}/practice`);
    console.log(`  Portal:     http://localhost:${port}/portal`);
    console.log(`  Template:   http://localhost:${port}/download/template`);
  });
}

export default app;
