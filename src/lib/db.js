/**
 * SQLite persistence (node:sqlite). File path from DATA_DIR or ./data.
 * Intellectual property: Lee Hine.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');

let db;

/**
 * Persistent data root (Railway volume mount `/app/data` in production).
 * Layout supports large client books without relying on container disk.
 */
export function getDataDir() {
  const dataDir = process.env.DATA_DIR || path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  for (const sub of ['db', 'uploads', 'exports', 'backups']) {
    fs.mkdirSync(path.join(dataDir, sub), { recursive: true });
  }
  return dataDir;
}

export function getDb() {
  if (db) return db;
  const dataDir = getDataDir();
  // Prefer /app/data/db on volume; keep legacy path if SQLITE_PATH set or old file exists
  const legacyPath = path.join(dataDir, 'spreadsheet-tax.sqlite');
  const preferredPath = path.join(dataDir, 'db', 'spreadsheet-tax.sqlite');
  let dbPath = process.env.SQLITE_PATH;
  if (!dbPath) {
    if (fs.existsSync(legacyPath) && !fs.existsSync(preferredPath)) {
      try {
        fs.renameSync(legacyPath, preferredPath);
        dbPath = preferredPath;
      } catch {
        dbPath = legacyPath;
      }
    } else {
      dbPath = preferredPath;
    }
  }
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  // Larger page cache helps firm books in the tens/hundreds of thousands of rows
  db.exec('PRAGMA cache_size = -64000;'); // ~64MB
  migrate(db);
  return db;
}

/** @param {DatabaseSync} database */
function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS firms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS firm_memberships (
      id TEXT PRIMARY KEY,
      firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      UNIQUE(firm_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      workflow_status TEXT NOT NULL,
      assignee_user_id TEXT,
      due_date TEXT,
      portal_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      client_id TEXT,
      firm_id TEXT,
      filename TEXT NOT NULL,
      payloads_json TEXT NOT NULL,
      summary_json TEXT,
      figures_json TEXT,
      validation_json TEXT,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submission_attempts (
      id TEXT PRIMARY KEY,
      draft_id TEXT,
      user_id TEXT,
      mode TEXT NOT NULL,
      ok INTEGER NOT NULL,
      results_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      firm_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY,
      firm_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      actor_user_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hmrc_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      firm_id TEXT,
      mode TEXT NOT NULL,
      authority_type TEXT NOT NULL,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      scopes TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      firm_id TEXT,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cta_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      path TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      user_id TEXT,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portal_invites (
      token TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      firm_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS firm_invites (
      token TEXT PRIMARY KEY,
      firm_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      invited_by TEXT,
      created_at TEXT NOT NULL,
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      email_reminders INTEGER NOT NULL DEFAULT 1,
      email_product INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  // Lightweight column add for portal token on clients (ignore if exists)
  try {
    database.exec(
      `ALTER TABLE clients ADD COLUMN portal_token TEXT`
    );
  } catch {
    /* already exists */
  }
  try {
    database.exec(
      `ALTER TABLE user_preferences ADD COLUMN identifiers_json TEXT`
    );
  } catch {
    /* already exists */
  }

  // Allow workflow receipts without a draft (submission_attempts.draft_id nullable)
  try {
    const cols = database.prepare(`PRAGMA table_info(submission_attempts)`).all();
    const draftCol = cols.find((c) => c.name === 'draft_id');
    if (draftCol && draftCol.notnull === 1) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS submission_attempts_v2 (
          id TEXT PRIMARY KEY,
          draft_id TEXT,
          user_id TEXT,
          mode TEXT NOT NULL,
          ok INTEGER NOT NULL,
          results_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO submission_attempts_v2 (id, draft_id, user_id, mode, ok, results_json, created_at)
          SELECT id, draft_id, user_id, mode, ok, results_json, created_at FROM submission_attempts;
        DROP TABLE submission_attempts;
        ALTER TABLE submission_attempts_v2 RENAME TO submission_attempts;
      `);
    }
  } catch (e) {
    console.warn(
      'submission_attempts draft_id migration skipped:',
      e instanceof Error ? e.message : e
    );
  }

  // Scale indexes for large firm books (hundreds of thousands of clients)
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_clients_firm ON clients(firm_id);
    CREATE INDEX IF NOT EXISTS idx_clients_firm_status ON clients(firm_id, workflow_status);
    CREATE INDEX IF NOT EXISTS idx_clients_firm_due ON clients(firm_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_clients_firm_name ON clients(firm_id, display_name);
    CREATE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token);
    CREATE INDEX IF NOT EXISTS idx_drafts_user_created ON drafts(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_drafts_client ON drafts(client_id);
    CREATE INDEX IF NOT EXISTS idx_drafts_firm ON drafts(firm_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_user_created ON submission_attempts(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_firm_created ON audit_events(firm_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_workflow_client ON workflow_events(client_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON firm_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_memberships_firm ON firm_memberships(firm_id);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

/** Reset DB file handle (tests). */
export function resetDbForTests() {
  closeDb();
}
