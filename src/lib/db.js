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

export function getDb() {
  if (db) return db;
  const dataDir = process.env.DATA_DIR || path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath =
    process.env.SQLITE_PATH || path.join(dataDir, 'spreadsheet-tax.sqlite');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
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
      draft_id TEXT NOT NULL REFERENCES drafts(id),
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
  `);
  // Lightweight column add for portal token on clients (ignore if exists)
  try {
    database.exec(
      `ALTER TABLE clients ADD COLUMN portal_token TEXT`
    );
  } catch {
    /* already exists */
  }
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
