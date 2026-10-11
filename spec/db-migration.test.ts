import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySchema } from "../src/server/db/schema.ts";

// Risk named directly in this build's own plan: `CREATE TABLE IF NOT
// EXISTS` does nothing to an already-existing table, so the production
// Fly volume's existing `runs` table needs real `ALTER TABLE` statements
// for this week's new columns -- applied idempotently, since nothing else
// in CI or local `pnpm check` (both start from an empty DB) would ever
// catch getting this wrong. Uses its own throwaway DatabaseSync against a
// temp file, not the app's singleton, so no running server is needed.
describe("schema migration", () => {
  it("adds the new runs columns to an already-existing, pre-migration table", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));

    // What a table deployed before these columns existed looks like.
    db.exec(`
      CREATE TABLE runs (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at       INTEGER NOT NULL,
        ended_at         INTEGER,
        raw_score        INTEGER NOT NULL DEFAULT 0,
        collective_score INTEGER NOT NULL DEFAULT 0,
        peak_players     INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.exec(
      "INSERT INTO runs (started_at, ended_at, raw_score, collective_score, peak_players) VALUES (1, 2, 3, 4, 5)",
    );

    applySchema(db);

    const columns = (db.prepare("PRAGMA table_info(runs)").all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(["food_events", "is_record", "active_ms"]));

    const row = db.prepare("SELECT food_events, is_record, active_ms FROM runs").get() as Record<string, number>;
    expect(row.food_events).toBe(0);
    expect(row.is_record).toBe(0);
    expect(row.active_ms).toBe(0);

    db.close();
  });

  it("is idempotent -- applying it twice doesn't error or duplicate a column", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));

    applySchema(db);
    expect(() => applySchema(db)).not.toThrow();

    const columns = (db.prepare("PRAGMA table_info(runs)").all() as { name: string }[]).map((c) => c.name);
    expect(columns.filter((c) => c === "food_events")).toHaveLength(1);

    db.close();
  });

  it("works on a brand-new database too (CI/local's actual starting point)", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));

    expect(() => applySchema(db)).not.toThrow();
    const columns = (db.prepare("PRAGMA table_info(runs)").all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(["food_events", "is_record", "active_ms"]));

    db.close();
  });
});
