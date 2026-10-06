// The one Fly volume at /data is the only storage that survives a restart
// or redeploy, so that's where this lives in production; the Dockerfile
// sets DB_PATH accordingly. Locally (outside Docker) it defaults to a
// relative path so `pnpm start` works without extra setup.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/collective-snake.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");

// CREATE TABLE IF NOT EXISTS is the whole migration story this week: CI's
// tmpfs volume and Fly's real one both start empty, and this schema is a
// strict subset of the full design, nothing here needs migrating away
// later, only adding to.
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
