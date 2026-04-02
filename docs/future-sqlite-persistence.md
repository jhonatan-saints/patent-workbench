# Future: SQLite Local Persistence

This document specifies how to migrate Patent Workbench from its current in-memory session model to a fully persistent, encrypted SQLite database. No cloud dependency is introduced — all data remains on the user's machine.

---

## Table of contents

1. [Current state](#current-state)
2. [Goals](#goals)
3. [Chosen stack](#chosen-stack)
4. [Database schema](#database-schema)
5. [File layout](#file-layout)
6. [API contract changes](#api-contract-changes)
7. [Migration path for the Zustand store](#migration-path-for-the-zustand-store)
8. [Encryption with SQLCipher](#encryption-with-sqlcipher)
9. [Implementation checklist](#implementation-checklist)

---

## Current state

All workflow sessions live in the Zustand store as the `sessions: WorkflowSession[]` array (declared in `client/src/store/workbench.ts`). They exist only in browser memory and are lost on page refresh or browser close. There is no server-side persistence layer.

Key types involved (all in `client/src/types/index.ts`):

| Type | Description |
| --- | --- |
| `WorkflowSession` | Top-level record: id, timestamps, base idea, full artifact, model used, token totals |
| `PatentArtifact` | The invention being drafted: idea, domain, inventors, figures, 7 IDF sections |
| `ArtifactSection` | One completed IDF step: module id, selected content, timestamp, option index |
| `InventorInfo` | Individual inventor details |
| `FigureItem` | Diagram or image with base64 data URL |
| `ContextFile` | User-uploaded reference document (plain text) |

---

## Goals

- Sessions survive page refresh, browser close, and machine restart
- Data never leaves the local machine
- Sensitive IP is encrypted at rest (AES-256)
- The existing `WorkflowSession` / `PatentArtifact` TypeScript types remain unchanged
- The client Zustand store requires minimal changes — persistence becomes a side-effect, not a rewrite

---

## Chosen stack

| Package | Role |
| --- | --- |
| `better-sqlite3` | Synchronous SQLite driver for Node.js — zero async complexity, ideal for Express |
| `@bessw/sqlcipher-better-sqlite3` | Drop-in `better-sqlite3` replacement compiled against SQLCipher for AES-256 encryption |
| `zod` | Already present — used to validate data coming out of the DB before returning it to the client |

> **Why `better-sqlite3` and not Prisma or Drizzle?** The schema is simple and the data model is already defined in TypeScript. An ORM adds a build step and abstraction without benefit at this scale. Raw SQL with `better-sqlite3` is faster, simpler, and easier to audit.

---

## Database schema

The database lives at a configurable path, defaulting to `~/.patent-workbench/sessions.db`.

```sql
-- One row per workflow session
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  started_at      INTEGER NOT NULL,
  completed_at    INTEGER NOT NULL,
  base_idea       TEXT    NOT NULL,
  model           TEXT    NOT NULL,
  total_tokens    INTEGER NOT NULL DEFAULT 0,

  -- Full PatentArtifact stored as JSON.
  -- Storing as a single blob keeps the schema flat and avoids
  -- complex joins for a document-oriented data model like IDF artifacts.
  artifact_json   TEXT    NOT NULL,

  -- Optional step input states (guided field values, manual drafts)
  step_states_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at DESC);
```

### Why JSON columns for nested data?

`PatentArtifact` is a deeply nested document: it contains 7 optional `ArtifactSection` records, an array of `InventorInfo`, an array of `FigureItem` (which may include large base64 strings), and an array of `ContextFile`. Normalising all of this into relational tables would require 5+ tables and complex joins for no real query benefit — sessions are always fetched whole. SQLite's `json_extract()` can still query inside the blob if needed (e.g., filtering by domain or inventor name).

---

## File layout

New files to create, relative to the project root:

```
server/src/
  db/
    client.ts         ← opens the DB, applies encryption key, runs migrations
    migrations.ts     ← CREATE TABLE statements, versioned via user_version pragma
    sessions.repo.ts  ← all SQL queries for sessions (insert, find, list, delete)
```

### `server/src/db/client.ts` (sketch)

```typescript
import Database from 'better-sqlite3'; // or sqlcipher variant
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const DB_DIR = process.env.DB_PATH ?? path.join(os.homedir(), '.patent-workbench');
const DB_FILE = path.join(DB_DIR, 'sessions.db');

fs.mkdirSync(DB_DIR, { recursive: true });

export const db = new Database(DB_FILE);

// WAL mode: faster writes, readers do not block writers
db.pragma('journal_mode = WAL');

// Foreign key enforcement
db.pragma('foreign_keys = ON');

// Encryption key (SQLCipher only) — loaded from env or a local key file
if (process.env.DB_ENCRYPTION_KEY) {
  db.pragma(`key = '${process.env.DB_ENCRYPTION_KEY}'`);
}
```

### `server/src/db/sessions.repo.ts` (sketch)

```typescript
import { db } from './client';
import type { WorkflowSession } from '../../shared/types'; // or import from client types

export function insertSession(session: WorkflowSession): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions
      (id, started_at, completed_at, base_idea, model, total_tokens, artifact_json, step_states_json)
    VALUES
      (@id, @started_at, @completed_at, @base_idea, @model, @total_tokens, @artifact_json, @step_states_json)
  `);
  stmt.run({
    id: session.id,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    base_idea: session.baseIdea,
    model: session.model,
    total_tokens: session.totalTokens,
    artifact_json: JSON.stringify(session.artifact),
    step_states_json: session.stepInputStates ? JSON.stringify(session.stepInputStates) : null,
  });
}

export function listSessions(): WorkflowSession[] {
  const rows = db.prepare(
    'SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100'
  ).all() as Record<string, unknown>[];
  return rows.map(deserialise);
}

export function getSession(id: string): WorkflowSession | undefined {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? deserialise(row) : undefined;
}

export function deleteSession(id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

function deserialise(row: Record<string, unknown>): WorkflowSession {
  return {
    id: row['id'] as string,
    startedAt: row['started_at'] as number,
    completedAt: row['completed_at'] as number,
    baseIdea: row['base_idea'] as string,
    model: row['model'] as string,
    totalTokens: row['total_tokens'] as number,
    artifact: JSON.parse(row['artifact_json'] as string),
    stepInputStates: row['step_states_json']
      ? JSON.parse(row['step_states_json'] as string)
      : undefined,
  };
}
```

---

## API contract changes

Four new Express routes are added to `server/src/app.ts`. The client already calls these actions via the Zustand store — they just need a real HTTP endpoint instead of operating in memory.

| Method | Route | Body / Params | Action |
| --- | --- | --- | --- |
| `POST` | `/sessions` | `WorkflowSession` JSON | Upsert a session |
| `GET` | `/sessions` | — | List all sessions (newest first) |
| `GET` | `/sessions/:id` | — | Fetch one full session |
| `DELETE` | `/sessions/:id` | — | Delete a session |

All four routes validate their inputs with the existing Zod middleware pattern already used on `/generate`.

---

## Migration path for the Zustand store

The store surface (`WorkbenchState`) does not change. Only the implementation of four actions changes — from pure in-memory array mutations to HTTP calls:

| Action | Current behaviour | New behaviour |
| --- | --- | --- |
| `saveCurrentSession()` | Pushes to `sessions[]` in memory | `POST /sessions` + update local `sessions[]` from response |
| `loadSession(session)` | Reads from `sessions[]` | No change — session object already in state after `GET /sessions` |
| `deleteSession(id)` | Filters `sessions[]` | `DELETE /sessions/:id` + filter local array |
| `clearSessions()` | Resets `sessions[]` to `[]` | `DELETE /sessions` (new bulk-delete route) + reset local array |

On app boot, the store calls `GET /sessions` once to hydrate `sessions[]` from the database. This replaces the current empty-array initialisation.

---

## Encryption with SQLCipher

SQLCipher encrypts every page of the `.db` file with AES-256-CBC. The key must be provided before any read or write.

### Key management options (choose one)

| Option | Security | Complexity |
| --- | --- | --- |
| Env variable (`DB_ENCRYPTION_KEY`) | Medium — key visible in process env | Low |
| File-based key (`~/.patent-workbench/.key`) | Medium — key on disk, restrict via OS permissions | Low |
| OS keychain (Windows Credential Manager / macOS Keychain) | High — key never touches disk | High |
| Derived from OS user identity (DPAPI on Windows) | High — key tied to user account | Medium |

For the initial implementation, a **file-based key** generated on first run is the pragmatic choice. The key file is created with `600` permissions (owner read/write only) alongside the database. The Electron path (future) can graduate to DPAPI/Keychain.

### Key generation on first run

```typescript
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

const KEY_FILE = path.join(DB_DIR, '.key');

function loadOrCreateKey(): string {
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  const key = randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}
```

---

## Implementation checklist

### Server

- [ ] Install `better-sqlite3` and `@types/better-sqlite3`
- [ ] Create `server/src/db/client.ts` — open DB, set pragmas, apply encryption key
- [ ] Create `server/src/db/migrations.ts` — `CREATE TABLE IF NOT EXISTS sessions`, index on `started_at`
- [ ] Create `server/src/db/sessions.repo.ts` — `insertSession`, `listSessions`, `getSession`, `deleteSession`
- [ ] Add routes `POST /sessions`, `GET /sessions`, `GET /sessions/:id`, `DELETE /sessions/:id` to `server/src/app.ts`
- [ ] Validate incoming session payload with a Zod schema
- [ ] Add `DB_PATH` and `DB_ENCRYPTION_KEY` to `.env.example`

### Client

- [ ] Add `saveSessions`, `loadSessions`, `deleteSession` typed fetch helpers to `client/src/api/client.ts`
- [ ] Update `saveCurrentSession()` in `workbench.ts` to `POST /sessions`
- [ ] Update `deleteSession()` in `workbench.ts` to `DELETE /sessions/:id`
- [ ] Update `clearSessions()` in `workbench.ts` to `DELETE /sessions`
- [ ] Add a `hydrateSessionsFromDb()` action that calls `GET /sessions` and populates `sessions[]`
- [ ] Call `hydrateSessionsFromDb()` on app boot (in `App.tsx` via a `useEffect`)

### Infrastructure

- [ ] Add `.patent-workbench/` to `.gitignore`
- [ ] Add migration version tracking via `PRAGMA user_version`
- [ ] Document key backup procedure in `docs/customising-reg-templates.md` or a dedicated ops doc
