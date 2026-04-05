import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'workbench.db'))

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')
db.pragma('wal_autocheckpoint = 1000') // checkpoint every ~4 MB;
db.pragma('foreign_keys = ON')

const SCHEMA_VERSION = 1

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT    PRIMARY KEY,
    started_at    INTEGER NOT NULL,
    completed_at  INTEGER,
    base_idea     TEXT    NOT NULL,
    model         TEXT    NOT NULL,
    total_tokens  INTEGER NOT NULL DEFAULT 0,
    artifact      TEXT    NOT NULL
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
`)

const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
if (version < SCHEMA_VERSION) {
  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}

export default db
