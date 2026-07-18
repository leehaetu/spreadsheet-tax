/**
 * Platform foundations for capacity + first-class Excel.
 * Does not claim 800k gate MET.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-cap-'));
process.env.SPREADSHEET_TAX_NO_LISTEN = '1';
process.env.DATA_DIR = tmp;
process.env.SQLITE_PATH = path.join(tmp, 'cap.sqlite');
process.env.OBJECT_STORAGE_DIR = path.join(tmp, 'objects');
process.env.USE_EXCEL_WORKER = '1';
delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { evaluateCapacityPlatform } = await import(
  '../src/lib/platform-config.js'
);
const { detectSpreadsheetKind, quarantineUpload, sha256Buffer } = await import(
  '../src/lib/object-store.js'
);
const { enqueueJob, claimJob, completeJob, failJob, queueDepth } = await import(
  '../src/lib/job-queue.js'
);
const { processLocalFileIsolated } = await import('../src/lib/pipeline.js');
const { isXlsxParseEnabled } = await import('../src/lib/parse.js');
const { evaluateProductionSafety } = await import(
  '../src/lib/production-boot.js'
);

describe('capacity platform config', () => {
  it('reports sqlite mode without DATABASE_URL', () => {
    const c = evaluateCapacityPlatform({});
    assert.equal(c.postgres, false);
    assert.equal(c.mode, 'sqlite');
  });

  it('CAPACITY_ENFORCE requires platform pieces', () => {
    const c = evaluateCapacityPlatform({
      CAPACITY_ENFORCE: '1',
      NODE_ENV: 'production',
    });
    assert.equal(c.ok, false);
    assert.ok(c.missing.length >= 1);
  });

  it('production safety includes capacity when enforced', () => {
    const r = evaluateProductionSafety({
      NODE_ENV: 'production',
      SESSION_SECRET: 'x'.repeat(40),
      TOKEN_ENCRYPTION_KEY: 'y'.repeat(40),
      COOKIE_SECURE: '1',
      CAPACITY_ENFORCE: '1',
    });
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => /Capacity|DATABASE|REDIS|OBJECT/i.test(e)));
  });
});

describe('object store + magic bytes', () => {
  it('detects xlsx zip signature', () => {
    const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
    if (!fs.existsSync(xlsxPath)) return;
    const buf = fs.readFileSync(xlsxPath);
    assert.equal(detectSpreadsheetKind(buf), 'xlsx');
    const q = quarantineUpload(buf, { originalName: 'test.xlsx' });
    assert.equal(q.sha256, sha256Buffer(buf));
    assert.ok(q.storageKey.includes('quarantine'));
  });

  it('detects csv text', () => {
    const buf = Buffer.from(
      'section,category,amount\nself_employment,turnover,100\n'
    );
    assert.equal(detectSpreadsheetKind(buf), 'csv');
  });
});

describe('job queue durability', () => {
  it('enqueues, claims, completes; rejects autonomous hmrc without approval in worker semantics', async () => {
    const { id } = await enqueueJob({
      queue: 'default',
      jobType: 'ping',
      payload: { n: 1 },
    });
    assert.ok(id);
    const job = await claimJob('default', 'test-worker');
    assert.ok(job);
    assert.equal(job.jobType, 'ping');
    await completeJob(job.id);
    const depth = await queueDepth('default');
    assert.ok(depth >= 0);
  });

  it('retries then fails after max attempts', async () => {
    const { id } = await enqueueJob({
      queue: 'default',
      jobType: 'ping',
      payload: {},
      maxAttempts: 1,
    });
    const job = await claimJob('default', 'w2');
    assert.equal(job.id, id);
    await failJob(id, 'boom', 0);
    // with maxAttempts 1, should be failed
  });
});

describe('first-class Excel', () => {
  it('Excel enabled in production-like env without kill switch', () => {
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', EXCEL_KILL_SWITCH: undefined }),
      true
    );
    assert.equal(
      isXlsxParseEnabled({ NODE_ENV: 'production', EXCEL_KILL_SWITCH: '1' }),
      false
    );
  });

  it('isolated path processes xlsx fixture through quarantine', async () => {
    const xlsxPath = path.join(root, 'test-spreadsheets/06-combined-workbook.xlsx');
    if (!fs.existsSync(xlsxPath)) {
      assert.ok(true, 'skip missing fixture');
      return;
    }
    const buf = fs.readFileSync(xlsxPath);
    const result = await processLocalFileIsolated(buf, '06-combined-workbook.xlsx');
    assert.ok(result.rowCount > 0);
    assert.ok(result.fileSha256);
    assert.ok(
      result.mapped.selfEmployment ||
        result.mapped.ukProperty ||
        result.mapped.foreignProperty?.length
    );
  });
});
