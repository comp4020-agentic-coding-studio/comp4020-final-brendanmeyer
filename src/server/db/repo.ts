// Everything this week's slice needs to persist: a pseudonym (with the
// token a browser uses to prove it's the same visitor later), and a
// finished run's score, linked to whoever played it.

import { randomUUID } from "node:crypto";
import { db } from "./index.ts";

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
}

export function recordRun(run: FinishedRun): number {
  const insertRun = db.prepare(
    `INSERT INTO runs (started_at, ended_at, raw_score, collective_score, peak_players)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const info = insertRun.run(
    run.startedAt,
    run.endedAt,
    run.rawScore,
    run.collectiveScore,
    run.peakPlayers,
  );
  const runId = Number(info.lastInsertRowid);

  const linkPlayer = db.prepare("INSERT INTO run_players (run_id, player_id) VALUES (?, ?)");
  for (const playerId of run.playerIds) {
    linkPlayer.run(runId, playerId);
  }
  return runId;
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
