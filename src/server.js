/**
 * Spreadsheet Tax — sales site + HMRC MTD ITSA bridging app (single service).
 */

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { processLocalFile } from './lib/pipeline.js';
import { createHmrcClient } from './lib/hmrc-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');

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
app.use('/templates', express.static(templatesDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'spreadsheet-tax', bridging: true });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'sales.html'));
});

app.get('/app', (_req, res) => {
  res.sendFile(path.join(publicDir, 'app.html'));
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
        return res.status(400).json({ error: 'No file uploaded. Use form field "file".' });
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
          foreignProperty: result.mapped.foreignProperty.map((f) => f.countryCode),
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
      res.status(500).json({ error: e instanceof Error ? e.message : 'Import failed' });
    }
  });
});

/**
 * Submit previously built payloads via HMRC client (sandbox or test double).
 */
app.post('/api/submit', async (req, res) => {
  try {
    const { payloads, nino, businessIdSe, businessIdUk, businessIdForeign, taxYear } =
      req.body || {};
    if (!payloads) {
      return res.status(400).json({ error: 'Missing payloads object from import preview' });
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
    res.status(500).json({ error: e instanceof Error ? e.message : 'Submit failed' });
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
  });
});

// Ensure template exists at runtime (Railway)
const templatePath = path.join(templatesDir, 'period-summary-template.csv');
if (!fs.existsSync(templatePath)) {
  console.warn('Warning: template CSV missing at', templatePath);
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Spreadsheet Tax listening on http://0.0.0.0:${port}`);
  console.log(`  Sales: http://localhost:${port}/`);
  console.log(`  App:   http://localhost:${port}/app`);
});

export default app;
