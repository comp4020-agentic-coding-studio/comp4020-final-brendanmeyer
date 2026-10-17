// Everything this week's slice needs to persist: a pseudonym (with the
// token a browser uses to prove it's the same visitor later), and a
// finished run's score, linked to whoever played it.

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { db } from "./index.ts";
import { isNewRecord, sortRecords } from "../../shared/leaderboard.ts";
import type { ReplaySample } from "../game/replay.ts";

export interface Player {
  id: number;
  name: string;
  token: string;
  hasPassword: boolean;
}

interface PlayerRow extends Player {
  passwordHash: string | null;
  passwordSalt: string | null;
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

// A blank password (null hash/salt, including every player claimed before
// this column existed) means that name is retrievable by anyone who just
// knows it -- no password required at all, not "must match a blank one".
function hashPassword(password: string): { hash: string; salt: string } | null {
  if (!password) return null;
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { hash, salt };
}

function verifyPassword(row: Pick<PlayerRow, "passwordHash" | "passwordSalt">, password: string): boolean {
  if (row.passwordHash === null || row.passwordSalt === null) return true;
  const candidate = scryptSync(password, row.passwordSalt, 32);
  const stored = Buffer.from(row.passwordHash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function findPlayerRowByNameLower(nameLower: string): PlayerRow | undefined {
  const row = db
    .prepare("SELECT id, name, token, password_hash AS passwordHash, password_salt AS passwordSalt FROM players WHERE name_lower = ?")
    .get(nameLower) as PlayerRow | undefined;
  return row;
}

// Resolves an already-connected identity before falling through to a fresh
// claim. A password-protected name proven with the *correct* password is an
// unambiguous, deliberate retrieval request -- it can't be supplied by
// accident -- so it's checked first and wins outright, even over a token
// the request happens to also carry (the real client always sends whatever
// token it has stored, which is very often a stale, unrelated identity from
// an earlier visit, not evidence the visitor wants that account instead).
// Only once that's ruled out does an ordinary token resume apply, and only
// after that does a plain, unprotected name collision fall through to
// renameName's existing "keep what you have" behaviour.
export function findExistingPlayer(token: string | undefined, name: string | undefined, password: string): Player | undefined {
  const trimmed = (name ?? "").trim();
  if (isValidName(trimmed)) {
    const row = findPlayerRowByNameLower(trimmed.toLowerCase());
    if (row && row.passwordHash !== null && verifyPassword(row, password)) {
      return { id: row.id, name: row.name, token: row.token, hasPassword: true };
    }
  }
  if (token) {
    const byToken = findPlayerByToken(token);
    if (byToken) return byToken;
  }
  if (!isValidName(trimmed)) return undefined;
  const row = findPlayerRowByNameLower(trimmed.toLowerCase());
  if (!row || !verifyPassword(row, password)) return undefined;
  return { id: row.id, name: row.name, token: row.token, hasPassword: row.passwordHash !== null };
}

export type ClaimResult =
  | { ok: true; player: Player; assignedName?: string }
  | { ok: false; reason: "taken" };

// Claims a pseudonym for a new session. An empty or invalid name gets a
// generated one instead of being rejected; an already-taken valid name is
// rejected outright (planning.md's case-insensitive uniqueness rule) --
// retrieving an existing name with its password is findExistingPlayer's
// job, called before this, so reaching here with a taken name is always a
// genuine conflict, not a retrieval opportunity missed.
export function claimName(requestedName: string | undefined, password: string): ClaimResult {
  const trimmed = (requestedName ?? "").trim();
  const wasValid = isValidName(trimmed);
  const name = wasValid ? trimmed : randomPseudonym();
  const nameLower = name.toLowerCase();
  const token = randomUUID();
  const hashed = hashPassword(password);

  const insert = db.prepare(
    "INSERT INTO players (name, name_lower, token, created_at, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)",
  );
  try {
    const info = insert.run(name, nameLower, token, Date.now(), hashed?.hash ?? null, hashed?.salt ?? null);
    return {
      ok: true,
      player: { id: Number(info.lastInsertRowid), name, token, hasPassword: hashed !== null },
      assignedName: wasValid ? undefined : name,
    };
  } catch (err) {
    if (isUniqueConstraintOn(err, "name_lower")) {
      if (!wasValid) return claimName(undefined, password); // regenerate on an astronomically unlikely clash
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
  const row = db
    .prepare("SELECT id, name, token, password_hash AS passwordHash FROM players WHERE token = ?")
    .get(token) as (Omit<Player, "hasPassword"> & { passwordHash: string | null }) | undefined;
  if (!row) return undefined;
  const { passwordHash, ...player } = row;
  return { ...player, hasPassword: passwordHash !== null };
}

export type SetPasswordResult = { ok: true } | { ok: false; reason: "alreadyHasPassword" | "blank" };

// Protects a name that was claimed with no password, after the fact --
// not a change/reset flow for one that already has a password (CLAUDE.md's
// "no changing a password later" still holds for an *existing* password;
// this only fills in a password where none was ever set). The WHERE clause
// itself enforces "only when currently none", so there's no read-then-write
// race between checking and setting it.
export function setPasswordIfNone(playerId: number, password: string): SetPasswordResult {
  if (!password) return { ok: false, reason: "blank" };
  const hashed = hashPassword(password);
  if (!hashed) return { ok: false, reason: "blank" };
  const info = db
    .prepare("UPDATE players SET password_hash = ?, password_salt = ? WHERE id = ? AND password_hash IS NULL")
    .run(hashed.hash, hashed.salt, playerId);
  if (info.changes === 0) return { ok: false, reason: "alreadyHasPassword" };
  return { ok: true };
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
  // The visitor's own best collective_score among runs they have a
  // run_players row for -- 0 with no stored token or no finished runs yet,
  // the same "nothing yet" default yourLastRun's null already uses.
  yourHighScore: number;
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
  let yourHighScore = 0;
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
    const bestRow = db
      .prepare(
        `SELECT MAX(r.collective_score) AS best
         FROM runs r
         JOIN run_players rp ON rp.run_id = r.id
         WHERE rp.player_id = ? AND r.ended_at IS NOT NULL`,
      )
      .get(player.id) as { best: number | null };
    yourHighScore = bestRow.best ?? 0;
  }

  return { yourLastRun, yourHighScore, allTimeBest: best ?? 0, totalRuns };
}

export interface EventRow {
  id: number;
  ts: number;
  type: string;
  playerId: number | null;
  details: Record<string, unknown>;
}

// Crit 10's audit log: "who did what," server-side, persisted beyond the
// crit session. Takes an explicit DatabaseSync (like applySchema) rather
// than closing over the module singleton, so src/server/log.ts's own tests
// can exercise it against a throwaway DB, the same pattern
// spec/db-migration.test.ts already established.
export function insertEvent(target: DatabaseSync, type: string, playerId: number | null, details: Record<string, unknown>): void {
  target
    .prepare("INSERT INTO events (ts, type, player_id, details) VALUES (?, ?, ?, ?)")
    .run(Date.now(), type, playerId, JSON.stringify(details));
}

export function listEvents(target: DatabaseSync, limit: number): EventRow[] {
  const rows = target
    .prepare("SELECT id, ts, type, player_id AS playerId, details FROM events ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as { id: number; ts: number; type: string; playerId: number | null; details: string }[];
  return rows.map((row) => ({ ...row, details: JSON.parse(row.details) }));
}
