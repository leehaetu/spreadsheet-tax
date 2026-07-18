/**
 * Seed capacity dataset: N practices + M clients.
 *
 * Default (CI-safe): 200 practices, 5_000 clients (spread, largest ~2k)
 * Full gate: CAPACITY_SEED_FULL=1 → 200 practices, 800_000 clients
 *   (largest practices get tens of thousands)
 *
 * Usage:
 *   node scripts/seed-capacity.js
 *   CAPACITY_SEED_FULL=1 node scripts/seed-capacity.js
 *   DATABASE_URL=postgres://... CAPACITY_SEED_FULL=1 node scripts/seed-capacity.js
 */

import crypto from 'node:crypto';
import { getDb, closeDb } from '../src/lib/db.js';
import { isPostgresMode } from '../src/lib/platform-config.js';
import { migratePostgres, pgQuery, closePool } from '../src/lib/pg-pool.js';
import { hashPassword } from '../src/lib/auth.js';

const FULL = process.env.CAPACITY_SEED_FULL === '1';
const PRACTICES = Number(process.env.CAPACITY_PRACTICES || 200);
const CLIENTS = FULL
  ? Number(process.env.CAPACITY_CLIENTS || 800_000)
  : Number(process.env.CAPACITY_CLIENTS || 5_000);

function id() {
  return crypto.randomUUID();
}

function allocateClientsPerPractice(practices, totalClients) {
  // A few large practices with tens of thousands (full mode), rest smaller
  const sizes = new Array(practices).fill(0);
  if (FULL && totalClients >= 800_000) {
    // 5 mega practices ~40k each, 15 large ~10k, rest share remainder
    const mega = 5;
    const large = 15;
    for (let i = 0; i < mega; i++) sizes[i] = 40_000;
    for (let i = mega; i < mega + large; i++) sizes[i] = 10_000;
    let used = mega * 40_000 + large * 10_000;
    const rest = practices - mega - large;
    const each = Math.floor((totalClients - used) / rest);
    for (let i = mega + large; i < practices; i++) sizes[i] = each;
    // fix remainder on last
    const sum = sizes.reduce((a, b) => a + b, 0);
    sizes[practices - 1] += totalClients - sum;
  } else {
    // CI: one large ~2000, rest equal
    sizes[0] = Math.min(2_000, Math.floor(totalClients / 2));
    const rest = totalClients - sizes[0];
    const each = Math.floor(rest / (practices - 1));
    for (let i = 1; i < practices; i++) sizes[i] = each;
    sizes[practices - 1] += totalClients - sizes.reduce((a, b) => a + b, 0);
  }
  return sizes;
}

async function seedSqlite() {
  const database = getDb();
  const now = new Date().toISOString();
  const pwd = hashPassword('CapacitySeed1!');
  const sizes = allocateClientsPerPractice(PRACTICES, CLIENTS);

  console.log(
    `[seed] SQLite practices=${PRACTICES} clients=${CLIENTS} full=${FULL}`
  );

  const insertFirm = database.prepare(
    `INSERT OR IGNORE INTO firms (id, name, type, created_at) VALUES (?, ?, ?, ?)`
  );
  const insertUser = database.prepare(
    `INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
  );
  const insertMem = database.prepare(
    `INSERT OR IGNORE INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, ?)`
  );
  const insertClient = database.prepare(
    `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );

  let clientIdx = 0;
  for (let p = 0; p < PRACTICES; p++) {
    const firmId = `firm-cap-${String(p).padStart(4, '0')}`;
    const userId = `user-cap-${String(p).padStart(4, '0')}`;
    insertFirm.run(firmId, `Capacity Practice ${p + 1}`, 'accountancy', now);
    insertUser.run(
      userId,
      `practice${p}@capacity.example`,
      pwd,
      `Admin ${p + 1}`,
      now
    );
    insertMem.run(id(), firmId, userId, 'practice_admin');
    const n = sizes[p];
    for (let i = 0; i < n; i++) {
      const idx = clientIdx + i;
      insertClient.run(
        id(),
        firmId,
        `Client ${idx}`,
        idx % 5 === 0 ? 'ready_to_submit' : 'awaiting_records',
        userId,
        '2026-07-05',
        now,
        now
      );
    }
    clientIdx += n;
    if ((p + 1) % 20 === 0) {
      console.log(`[seed] practices ${p + 1}/${PRACTICES} clients so far ${clientIdx}`);
    }
  }

  const firmCount = database.prepare(`SELECT COUNT(*) AS c FROM firms`).get().c;
  const clientCount = database
    .prepare(`SELECT COUNT(*) AS c FROM clients`)
    .get().c;
  const largest = database
    .prepare(
      `SELECT firm_id, COUNT(*) AS c FROM clients GROUP BY firm_id ORDER BY c DESC LIMIT 1`
    )
    .get();
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'sqlite',
        firms: firmCount,
        clients: clientCount,
        largestPracticeClients: largest?.c,
        largestFirmId: largest?.firm_id,
      },
      null,
      2
    )
  );
}

async function seedPostgres() {
  await migratePostgres();
  const now = new Date().toISOString();
  const pwd = hashPassword('CapacitySeed1!');
  const sizes = allocateClientsPerPractice(PRACTICES, CLIENTS);
  console.log(
    `[seed] Postgres practices=${PRACTICES} clients=${CLIENTS} full=${FULL}`
  );

  let clientIdx = 0;
  for (let p = 0; p < PRACTICES; p++) {
    const firmId = `firm-cap-${String(p).padStart(4, '0')}`;
    const userId = `user-cap-${String(p).padStart(4, '0')}`;
    await pgQuery(
      `INSERT INTO firms (id, name, type, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [firmId, `Capacity Practice ${p + 1}`, 'accountancy', now]
    );
    await pgQuery(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [userId, `practice${p}@capacity.example`, pwd, `Admin ${p + 1}`, now]
    );
    await pgQuery(
      `INSERT INTO firm_memberships (id, firm_id, user_id, role) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [id(), firmId, userId, 'practice_admin']
    );
    const n = sizes[p];
    const batch = 1000;
    for (let off = 0; off < n; off += batch) {
      const chunk = Math.min(batch, n - off);
      const values = [];
      const params = [];
      let pi = 1;
      // build multi-value insert with $ placeholders manually
      const placeholders = [];
      for (let i = 0; i < chunk; i++) {
        const idx = clientIdx + off + i;
        placeholders.push(
          `($${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},0,$${pi++},$${pi++})`
        );
        params.push(
          id(),
          firmId,
          `Client ${idx}`,
          idx % 5 === 0 ? 'ready_to_submit' : 'awaiting_records',
          userId,
          '2026-07-05',
          now,
          now
        );
      }
      const { getPool } = await import('../src/lib/pg-pool.js');
      await getPool().query(
        `INSERT INTO clients (id, firm_id, display_name, workflow_status, assignee_user_id, due_date, portal_enabled, created_at, updated_at)
         VALUES ${placeholders.join(',')}`,
        params
      );
    }
    clientIdx += n;
    if ((p + 1) % 20 === 0) {
      console.log(`[seed] practices ${p + 1}/${PRACTICES}`);
    }
  }
  const firms = await pgQuery(`SELECT COUNT(*)::int AS c FROM firms`);
  const clients = await pgQuery(`SELECT COUNT(*)::int AS c FROM clients`);
  const largest = await pgQuery(
    `SELECT firm_id, COUNT(*)::int AS c FROM clients GROUP BY firm_id ORDER BY c DESC LIMIT 1`
  );
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'postgres',
        firms: firms.rows[0].c,
        clients: clients.rows[0].c,
        largestPracticeClients: largest.rows[0]?.c,
      },
      null,
      2
    )
  );
}

async function main() {
  try {
    if (isPostgresMode()) await seedPostgres();
    else await seedSqlite();
  } finally {
    closeDb();
    if (isPostgresMode()) await closePool();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
