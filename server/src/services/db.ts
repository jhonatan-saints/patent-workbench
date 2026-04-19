import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import defaultTemplate from '../config/defaultTemplate'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// Restrict data directory and DB file to owner-only on Unix/macOS.
// On Windows this is a no-op — use NTFS ACLs or BitLocker at the OS level.
if (process.platform !== 'win32') {
  fs.chmodSync(DATA_DIR, 0o700) // rwx
}

const DB_PATH = path.join(DATA_DIR, 'workbench.db')
const db = new Database(DB_PATH)

if (process.platform !== 'win32') {
  fs.chmodSync(DB_PATH, 0o600) // rw
}

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('wal_autocheckpoint = 1000') // checkpoint every ~4 MB;
db.pragma('foreign_keys = ON')

const SCHEMA_VERSION = 8

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id                 TEXT    PRIMARY KEY,
    started_at         INTEGER NOT NULL,
    completed_at       INTEGER,
    base_idea          TEXT    NOT NULL,
    model              TEXT    NOT NULL,
    total_tokens       INTEGER NOT NULL DEFAULT 0,
    artifact           TEXT    NOT NULL,
    step_input_states  TEXT,
    figures_draft      TEXT,
    nav_state          TEXT
  );

  CREATE TABLE IF NOT EXISTS figures (
    id         TEXT    PRIMARY KEY,
    session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    caption    TEXT    NOT NULL DEFAULT '',
    width      INTEGER,
    height     INTEGER,
    type       TEXT    NOT NULL DEFAULT 'image',
    data_url   TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    default_model       TEXT    NOT NULL DEFAULT 'qwen2.5:7b',
    llm_timeout_ms      INTEGER NOT NULL DEFAULT 300000,
    num_options         INTEGER NOT NULL DEFAULT 3,
    ollama_url          TEXT    NOT NULL DEFAULT 'http://localhost:11434',
    prompt_max_length   INTEGER NOT NULL DEFAULT 16000,
    shutdown_timeout_ms INTEGER NOT NULL DEFAULT 3600000,
    log_level           TEXT    NOT NULL DEFAULT 'info',
    reg_template        TEXT,
    api_key             TEXT
  );
`)

const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
if (version < SCHEMA_VERSION) {
  // v2: add step_input_states column
  try { db.exec(`ALTER TABLE sessions ADD COLUMN step_input_states TEXT`) } catch { /* already exists */ }
  // v3: add figures_draft column
  try { db.exec(`ALTER TABLE sessions ADD COLUMN figures_draft TEXT`) } catch { /* already exists */ }
  // v4: add nav_state column
  try { db.exec(`ALTER TABLE sessions ADD COLUMN nav_state TEXT`) } catch { /* already exists */ }
  // v5: add app_settings table (already handled by CREATE TABLE IF NOT EXISTS above)
  // v6: add prompt_max_length, shutdown_timeout_ms, log_level columns
  try { db.exec(`ALTER TABLE app_settings ADD COLUMN prompt_max_length   INTEGER NOT NULL DEFAULT 16000`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE app_settings ADD COLUMN shutdown_timeout_ms INTEGER NOT NULL DEFAULT 3600000`) } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE app_settings ADD COLUMN log_level           TEXT    NOT NULL DEFAULT 'info'`) } catch { /* already exists */ }
  // v7: add reg_template column
  try { db.exec(`ALTER TABLE app_settings ADD COLUMN reg_template TEXT`) } catch { /* already exists */ }
  // v8: add api_key column
  try { db.exec(`ALTER TABLE app_settings ADD COLUMN api_key TEXT`) } catch { /* already exists */ }
  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}

// Seed app_settings from env vars on first run (INSERT OR IGNORE keeps existing values)
db.prepare(`
  INSERT OR IGNORE INTO app_settings
    (id, default_model, llm_timeout_ms, num_options, ollama_url, prompt_max_length, shutdown_timeout_ms, log_level, reg_template)
  VALUES (1, ?, ?, 3, ?, ?, ?, ?, ?)
`).run(
  process.env.DEFAULT_MODEL             || 'qwen2.5:7b',
  Number(process.env.LLM_TIMEOUT_MS)   || 300_000,
  process.env.OLLAMA_URL               || 'http://localhost:11434',
  Number(process.env.PROMPT_MAX_LENGTH) || 16_000,
  Number(process.env.SHUTDOWN_TIMEOUT_MS) || 3_600_000,
  process.env.LOG_LEVEL                || 'info',
  JSON.stringify(defaultTemplate)
)

// Backfill reg_template for existing rows that pre-date v7
db.prepare(`
  UPDATE app_settings SET reg_template = ? WHERE id = 1 AND reg_template IS NULL
`).run(JSON.stringify(defaultTemplate))

export interface AppSettingsRow {
  id: number
  default_model: string
  llm_timeout_ms: number
  num_options: number
  ollama_url: string
  prompt_max_length: number
  shutdown_timeout_ms: number
  log_level: string
  reg_template: string
  api_key: string | null
}

export function getAppSettings(): AppSettingsRow {
  return db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as AppSettingsRow
}

export function getRegTemplate(): unknown {
  const row = db.prepare('SELECT reg_template FROM app_settings WHERE id = 1').get() as { reg_template: string }
  return JSON.parse(row.reg_template)
}

export function setRegTemplate(template: unknown): void {
  db.prepare('UPDATE app_settings SET reg_template = ? WHERE id = 1').run(JSON.stringify(template))
}

export default db
