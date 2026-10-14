// Crit 10's audit log: "your final project logs who did what, server-side,
// and the logging outlives the crit." console.log is what a presenter
// narrates live from (`flyctl logs -a <repo>`, the crit's own suggested
// tool); insertEvent against the one Fly volume at /data is what survives
// after the crit session ends. No HTTP read-back route -- the spec never
// asks for one, and these two channels already satisfy both halves of it.

import { db } from "./db/index.ts";
import { insertEvent } from "./db/repo.ts";

// Pulls a readable name out of whatever shape of details a given event
// type carries, so every line names who it's about -- the crit's own
// named failure condition is being unable to tell two classmates apart in
// the logs. Pure, no DB or socket, so it's unit-tested directly
// (spec/events.test.ts) against every event type this build logs.
export function formatEvent(type: string, details: Record<string, unknown>): string {
  const who = typeof details.name === "string" ? details.name : describePlayers(details.players);
  return `[${type}] ${who} ${JSON.stringify(details)}`;
}

function describePlayers(players: unknown): string {
  if (!Array.isArray(players)) return "?";
  return players
    .map((p) => (p && typeof p === "object" && "name" in p ? String((p as { name: unknown }).name) : "?"))
    .join(",");
}

export function logEvent(type: string, playerId: number | null, details: Record<string, unknown>): void {
  console.log(formatEvent(type, details));
  insertEvent(db, type, playerId, details);
}
