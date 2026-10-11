// Everything this week's slice needs to persist: a pseudonym (with the
// token a browser uses to prove it's the same visitor later), and a
// finished run's score, linked to whoever played it.

import { randomUUID } from "node:crypto";
import { db } from "./index.ts";
import { isNewRecord, sortRecords } from "../../shared/leaderboard.ts";
import type { ReplaySample } from "../game/replay.ts";

export interface Player {
  id: number;
  name: string;
  token: string;
}

const NAME_PATTERN = /^[a-zA-Z0-9]{1,22}$/;

function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

function randomPseudonym(): string {
  return `player${randomUUID().slice(0, 6)}`;
}

function isUniqueConstraintOn(err: unknown, column: string): boolean {
  return err instanceof Error && err.message.includes(`UNIQUE constraint failed: players.${column}`);
}

export type ClaimResult =
  | { ok: true; player: Player; assignedName?: string }
  | { ok: false; reason: "taken" };

// Claims a pseudonym for a new session. An empty or invalid name gets a
// generated one instead of being rejected; an already-taken valid name is
// rejected outright (planning.md's case-insensitive uniqueness rule).
export function claimName(requestedName: string | undefined): ClaimResult {
  const trimmed = (requestedName ?? "").trim();
  const wasValid = isValidName(trimmed);
  const name = wasValid ? trimmed : randomPseudonym();
  const nameLower = name.toLowerCase();
  const token = randomUUID();

  const insert = db.prepare(
    "INSERT INTO players (name, name_lower, token, created_at) VALUES (?, ?, ?, ?)",
  );
  try {
    const info = insert.run(name, nameLower, token, Date.now());
    return {
      ok: true,
      player: { id: Number(info.lastInsertRowid), name, token },
      assignedName: wasValid ? undefined : name,
    };
  } catch (err) {
    if (isUniqueConstraintOn(err, "name_lower")) {
      if (!wasValid) return claimName(undefined); // regenerate on an astronomically unlikely clash
      return { ok: false, reason: "taken" };
    }
    throw err;
  }
}

export type RenameResult = { ok: true; name: string } | { ok: false };

// A generated pseudonym isn't meant to be permanent -- a returning visitor
// choosing a real name on the entry screen should actually adopt it.
// Silently keeps the existing name on an invalid or already-taken request
// rather than erroring, the same tolerant-fallback shape as claimName: this
// runs on every resume, including one where the name box still just shows
// the name already in effect, so "no actual change requested" must be a
// harmless no-op too.
export function renameName(playerId: number, requestedName: string): RenameResult {
  const trimmed = requestedName.trim();
  if (!isValidName(trimmed)) return { ok: false };
  const nameLower = trimmed.toLowerCase();
  try {
    db.prepare("UPDATE players SET name = ?, name_lower = ? WHERE id = ?").run(trimmed, nameLower, playerId);
    return { ok: true, name: trimmed };
  } catch (err) {
    if (isUniqueConstraintOn(err, "name_lower")) return { ok: false };
    throw err;
  }
}

export function findPlayerByToken(token: string): Player | undefined {
  return db.prepare("SELECT id, name, token FROM players WHERE token = ?").get(token) as
    | Player
    | undefined;
}

export interface FinishedRun {
  startedAt: number;
  endedAt: number;
  rawScore: number;
  collectiveScore: number;
  peakPlayers: number;
  playerIds: number[];
  foodEvents: number;
  activeMs: number;
}

export interface RecordRunResult {
  runId: number;
  // Strictly higher than the prior best (planning.md section 19) -- a tie
  // is never a new record, checked here before inserting so this run's own
  // score can't count as its own "previous best".
  isRecord: boolean;
}

export function recordRun(run: FinishedRun): RecordRunResult {
  const previousBest = (
    db.prepare("SELECT MAX(collective_score) AS best FROM runs WHERE ended_at IS NOT NULL").get() as {
      best: number | null;
    }
  ).best;
  const isRecord = isNewRecord(run.collectiveScore, previousBest);

  const insertRun = db.prepare(
    `INSERT INTO runs (started_at, ended_at, raw_score, collective_score, peak_players, food_events, active_ms, is_record)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const info = insertRun.run(
    run.startedAt,
    run.endedAt,
    run.rawScore,
    run.collectiveScore,
    run.peakPlayers,
    run.foodEvents,
    run.activeMs,
    isRecord ? 1 : 0,
  );
  const runId = Number(info.lastInsertRowid);

  const linkPlayer = db.prepare("INSERT INTO run_players (run_id, player_id) VALUES (?, ?)");
  for (const playerId of run.playerIds) {
    linkPlayer.run(runId, playerId);
  }
  return { runId, isRecord };
}

export interface GlobalStats {
  totalRuns: number;
  totalFoodCollected: number;
  totalUniquePlayers: number;
  totalPlayTimeMs: number;
  largestActiveGroup: number;
  recordCollectiveScore: number;
}

// planning.md section 22: the public global-stats view.
export function getGlobalStats(): GlobalStats {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS totalRuns,
         COALESCE(SUM(food_events), 0) AS totalFoodCollected,
         COALESCE(SUM(active_ms), 0) AS totalPlayTimeMs,
         COALESCE(MAX(peak_players), 0) AS largestActiveGroup,
         COALESCE(MAX(collective_score), 0) AS recordCollectiveScore
       FROM runs WHERE ended_at IS NOT NULL`,
    )
    .get() as Omit<GlobalStats, "totalUniquePlayers">;

  const totalUniquePlayers = (
    db.prepare("SELECT COUNT(DISTINCT player_id) AS n FROM run_players").get() as { n: number }
  ).n;

  return { ...totals, totalUniquePlayers };
}

export interface RecordRunRow {
  runId: number;
  collectiveScore: number;
  rawScore: number;
  endedAt: number;
  peakPlayers: number;
}

// planning.md section 19/21: every run that was a record when it finished,
// in leaderboard order -- this *is* "the record run" (the top entry) and
// "all historical record runs" (the rest), no separate records table.
export function listRecordRuns(): RecordRunRow[] {
  const rows = db
    .prepare(
      `SELECT id AS runId, collective_score AS collectiveScore, raw_score AS rawScore,
              ended_at AS endedAt, peak_players AS peakPlayers
       FROM runs WHERE is_record = 1`,
    )
    .all() as unknown as RecordRunRow[];
  return sortRecords(rows);
}

// Only ever called for a run db/repo.ts's own recordRun() already said was
// a record (planning.md section 21) -- every other run's buffered samples
// are just discarded, never reaching here.
export function saveReplaySamples(runId: number, samples: ReplaySample[]): void {
  const insert = db.prepare(
    `INSERT INTO run_samples (run_id, seq, elapsed_ms, snake_path, players, raw_score, collective_score, active_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  samples.forEach((sample, seq) => {
    insert.run(
      runId,
      seq,
      sample.elapsedMs,
      JSON.stringify(sample.snakePath),
      JSON.stringify(sample.players),
      sample.rawScore,
      sample.collectiveScore,
      sample.activeCount,
    );
  });
}

export function getReplay(runId: number): ReplaySample[] {
  const rows = db
    .prepare(
      `SELECT elapsed_ms AS elapsedMs, snake_path AS snakePath, players,
              raw_score AS rawScore, collective_score AS collectiveScore, active_count AS activeCount
       FROM run_samples WHERE run_id = ? ORDER BY seq ASC`,
    )
    .all(runId) as unknown as { elapsedMs: number; snakePath: string; players: string; rawScore: number; collectiveScore: number; activeCount: number }[];

  return rows.map((row) => ({
    elapsedMs: row.elapsedMs,
    snakePath: JSON.parse(row.snakePath),
    players: JSON.parse(row.players),
    rawScore: row.rawScore,
    collectiveScore: row.collectiveScore,
    activeCount: row.activeCount,
  }));
}

export interface Summary {
  yourLastRun: { score: number; collectiveScore: number; endedAt: number } | null;
  allTimeBest: number;
  totalRuns: number;
}

export function getSummary(token: string | null): Summary {
  const totalRuns = (
    db.prepare("SELECT COUNT(*) AS n FROM runs WHERE ended_at IS NOT NULL").get() as { n: number }
  ).n;

  const best = (
    db.prepare("SELECT MAX(collective_score) AS best FROM runs WHERE ended_at IS NOT NULL").get() as {
      best: number | null;
    }
  ).best;

  let yourLastRun: Summary["yourLastRun"] = null;
  const player = token ? findPlayerByToken(token) : undefined;
  if (player) {
    const row = db
      .prepare(
        `SELECT r.raw_score AS rawScore, r.collective_score AS collectiveScore, r.ended_at AS endedAt
         FROM runs r
         JOIN run_players rp ON rp.run_id = r.id
         WHERE rp.player_id = ? AND r.ended_at IS NOT NULL
         ORDER BY r.ended_at DESC
         LIMIT 1`,
      )
      .get(player.id) as { rawScore: number; collectiveScore: number; endedAt: number } | undefined;
    if (row) {
      yourLastRun = { score: row.rawScore, collectiveScore: row.collectiveScore, endedAt: row.endedAt };
    }
  }

  return { yourLastRun, allTimeBest: best ?? 0, totalRuns };
}
