/**
 * Migrate SQLite app data → PostgreSQL (rehearsal / cutover helper).
 *
 * Usage:
 *   SQLITE_PATH=./data/db/spreadsheet-tax.sqlite DATABASE_URL=postgres://... \
 *     node scripts/migrate-sqlite-to-postgres.js
 *
 * Does NOT claim capacity gate MET. Produces row counts + checksums for reconciliation.
 * Never drops target tables without MIGRATE_DROP_TARGET=1.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isPostgresMode } from '../src/lib/platform-config.js';
import { migratePostgres, pgQuery, closePool } from '../src/lib/pg-pool.js';

const sqlitePath =
  process.env.SQLITE_PATH ||
  path.join(process.cwd(), 'data', 'db', 'spreadsheet-tax.sqlite');

if (!isPostgresMode()) {
  console.error('DATABASE_URL required');
  process.exit(1);
}
if (!fs.existsSync(sqlitePath)) {
  console.error('SQLite file not found:', sqlitePath);
  process.exit(1);
}

const TABLES = [
  'users',
  'sessions',
  'firms',
  'firm_memberships',
  'clients',
  'drafts',
  'submission_attempts',
  'audit_events',
  'taxpayer_profiles',
  'income_sources',
  'period_snapshots',
  'spreadsheet_reviews',
  'eoy_cases',
  'workflow_events',
];

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

function checksum(rows) {
  const h = crypto.createHash('sha256');
  h.update(JSON.stringify(rows));
  return h.digest('hex').slice(0, 16);
}

async function main() {
  await migratePostgres();
  /** @type {Record<string, { source: number, target: number, checksum: string }>} */
  const report = {};

  for (const table of TABLES) {
    let rows = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      console.warn('skip missing sqlite table', table);
      continue;
    }
    const cs = checksum(rows);
    if (process.env.MIGRATE_DROP_TARGET === '1') {
      await pgQuery(`DELETE FROM ${table}`);
    }
    let inserted = 0;
    for (const row of rows) {
      const cols = Object.keys(row);
      if (!cols.length) continue;
      const placeholders = cols.map(() => '?').join(',');
      const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      try {
        await pgQuery(sql, cols.map((c) => row[c]));
        inserted++;
      } catch (e) {
        // Column mismatch — log and continue
        if (inserted === 0 && rows.indexOf(row) === 0) {
          console.warn(table, e instanceof Error ? e.message : e);
        }
      }
    }
    let targetCount = 0;
    try {
      const r = await pgQuery(`SELECT COUNT(*)::int AS c FROM ${table}`);
      targetCount = r.rows[0]?.c || 0;
    } catch {
      targetCount = -1;
    }
    report[table] = {
      source: rows.length,
      target: targetCount,
      attemptedInserts: inserted,
      checksum: cs,
    };
    console.log(
      `${table}: source=${rows.length} target=${targetCount} checksum=${cs}`
    );
  }

  const outPath = path.join(
    process.cwd(),
    'data',
    'exports',
    `migrate-report-${Date.now()}.json`
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        sqlitePath,
        capacityGateMet: false,
        note: 'Migration report only — capacity gate still requires load proof',
        report,
      },
      null,
      2
    )
  );
  console.log('Wrote', outPath);
  await closePool();
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
