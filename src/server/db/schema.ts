// CREATE TABLE IF NOT EXISTS is the whole migration story for a table that
// doesn't exist yet -- but it does nothing to one that already does, and
// the production Fly volume's `runs` table already exists from crit 8/9.
// New columns on an existing table need real ALTER TABLE statements,
// applied idempotently (checked first, not relying on SQLite's own
// IF NOT EXISTS support for ADD COLUMN) since CI and local pnpm check both
// start from an empty DB and would never catch getting this wrong
// (see spec/db-migration.test.ts).

import type { DatabaseSync } from "node:sqlite";

function columnExists(db: DatabaseSync, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((row) => row.name === column);
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string): void {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function applySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      name_lower TEXT NOT NULL UNIQUE,
      token      TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at       INTEGER NOT NULL,
      ended_at         INTEGER,
      raw_score        INTEGER NOT NULL DEFAULT 0,
      collective_score INTEGER NOT NULL DEFAULT 0,
      peak_players     INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS run_players (
      run_id    INTEGER NOT NULL REFERENCES runs(id),
      player_id INTEGER NOT NULL REFERENCES players(id),
      PRIMARY KEY (run_id, player_id)
    )
  `);

  // Only ever written for a run that turns out to be a record (planning.md
  // section 21) -- a brand-new table needs no migration, CREATE TABLE IF
  // NOT EXISTS already covers both a fresh database and the existing
  // deployed one.
  db.exec(`
    CREATE TABLE IF NOT EXISTS run_samples (
      run_id           INTEGER NOT NULL REFERENCES runs(id),
      seq              INTEGER NOT NULL,
      elapsed_ms       INTEGER NOT NULL,
      snake_path       TEXT NOT NULL,
      players          TEXT NOT NULL,
      raw_score        INTEGER NOT NULL,
      collective_score INTEGER NOT NULL,
      active_count     INTEGER NOT NULL,
      PRIMARY KEY (run_id, seq)
    )
  `);

  // This week's additions to `runs` (planning.md sections 19, 20, 22):
  // food_events and total play time feed /api/stats; is_record is what
  // defines "the record run" and "all historical record runs" (set true
  // only on a strict improvement, never a tie -- section 19).
  addColumnIfMissing(db, "runs", "food_events", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "runs", "is_record", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "runs", "active_ms", "INTEGER NOT NULL DEFAULT 0");

  // Password-based retrieval: null means no password was ever set for that
  // name (every pre-existing player, from before this column existed,
  // defaults to null here -- freely retrievable by name alone, the same
  // rule as a fresh claim with a blank password).
  addColumnIfMissing(db, "players", "password_hash", "TEXT");
  addColumnIfMissing(db, "players", "password_salt", "TEXT");

  // Crit 10: a server-side audit log, "who did what," that outlives the
  // crit session itself -- the one Fly volume at /data is this app's only
  // durable store, so that's where persistence has to live. Brand new
  // table, so CREATE TABLE IF NOT EXISTS is the whole migration story, the
  // same as run_samples above -- no ALTER TABLE risk like runs/players had.
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      ts        INTEGER NOT NULL,
      type      TEXT NOT NULL,
      player_id INTEGER,
      details   TEXT NOT NULL
    )
  `);
}
