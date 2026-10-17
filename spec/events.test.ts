import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySchema } from "../src/server/db/schema.ts";
import { insertEvent, listEvents } from "../src/server/db/repo.ts";
import { formatEvent } from "../src/server/log.ts";

// Crit 10's actual spec: "your final project logs who did what, server-side,
// and the logging outlives the crit" -- the `events` table is a brand-new
// table (unlike `runs`), so CREATE TABLE IF NOT EXISTS is the whole
// migration story, no ALTER TABLE needed. These specs use their own
// throwaway DatabaseSync, the same pattern as db-migration.test.ts, since
// they're about the schema/repo layer, not the running app over HTTP.
describe("events table", () => {
  it("gets created by applySchema", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));

    applySchema(db);

    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name,
    );
    expect(tables).toContain("events");

    db.close();
  });

  it("applySchema stays idempotent with events already present", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));

    applySchema(db);
    expect(() => applySchema(db)).not.toThrow();

    db.close();
  });
});

describe("insertEvent / listEvents", () => {
  it("round-trips events in reverse-chronological order, with details as parsed JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));
    applySchema(db);

    insertEvent(db, "player_connected", 1, { playerId: 1, name: "alice", mode: "claimed" });
    insertEvent(db, "player_connected", 2, { playerId: 2, name: "bob", mode: "claimed" });
    insertEvent(db, "player_renamed", 1, { playerId: 1, from: "alice", to: "allie" });

    const events = listEvents(db, 10);
    expect(events).toHaveLength(3);
    // Newest first.
    expect(events[0]).toMatchObject({ type: "player_renamed", playerId: 1 });
    expect(events[0].details).toEqual({ playerId: 1, from: "alice", to: "allie" });
    expect(events[2]).toMatchObject({ type: "player_connected", playerId: 1 });
    expect(events[2].details).toEqual({ playerId: 1, name: "alice", mode: "claimed" });

    db.close();
  });

  it("respects the limit", () => {
    const dir = mkdtempSync(join(tmpdir(), "collective-snake-test-"));
    const db = new DatabaseSync(join(dir, "test.db"));
    applySchema(db);

    for (let i = 0; i < 5; i++) {
      insertEvent(db, "player_connected", i, { playerId: i, name: `p${i}`, mode: "claimed" });
    }

    expect(listEvents(db, 2)).toHaveLength(2);
  });
});

// The crit's explicitly-named failure condition: "being unable to
// distinguish the two classmates in the logs." formatEvent is the pure
// function behind every console.log line, so this is checked directly and
// for every event type the build logs -- not just the two or three an
// end-to-end WS test could reach.
describe("formatEvent", () => {
  it("distinguishes two different players' events of the same type", () => {
    const a = formatEvent("player_connected", { playerId: 1, name: "alice", mode: "claimed" });
    const b = formatEvent("player_connected", { playerId: 2, name: "bob", mode: "claimed" });
    expect(a).not.toBe(b);
    expect(a).toContain("alice");
    expect(b).toContain("bob");
  });

  it("formats every event type this build logs, each mentioning the player's name", () => {
    const cases: [string, Record<string, unknown>][] = [
      ["player_connected", { name: "alice", mode: "claimed" }],
      ["player_renamed", { name: "allie", from: "alice", to: "allie" }],
      ["player_duplicate_detected", { name: "alice" }],
      ["player_takeover", { name: "alice" }],
      ["player_disconnected", { name: "alice", reason: "closed" }],
      ["role_changed", { name: "alice", from: "introducing", to: "active" }],
      ["queue_joined", { name: "carol", position: 1 }],
      ["queue_offer_made", { name: "carol" }],
      ["queue_offer_declined", { name: "carol", reason: "expired" }],
      ["food_eaten", { players: [{ playerId: 1, name: "alice" }], rawScore: 100, collectiveScore: 110, n: 2 }],
      [
        "run_finished",
        { startedAt: 1, endedAt: 2, rawScore: 100, collectiveScore: 110, isRecord: false, players: [{ playerId: 1, name: "alice" }] },
      ],
      [
        "positions_snapshot",
        { players: [{ playerId: 1, name: "alice", x: 0.5, y: 0.5 }, { playerId: 2, name: "bob", x: 0.2, y: 0.8 }] },
      ],
    ];
    for (const [type, details] of cases) {
      const line = formatEvent(type, details);
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });
});
