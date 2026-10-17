// The seven states a connection can be in (planning.md sections 2, 4, 5, 6,
// 7), the timing constants those sections name, and the pure decision
// sweep() applies every tick -- kept separate from ws.ts's connection
// registry so the timing logic is unit-testable without a real socket or
// real elapsed time (see spec/roles.test.ts).

import type { YourView } from "../../shared/protocol.ts";

export type Role = "active" | "introducing" | "leaving" | "resuming" | "starting" | "spectator" | "queued" | "offered";

export const MAX_ACTIVE = 12;
export const INTRO_MS = 2000;
export const LEAVE_FLASH_MS = 2000;
export const DISCONNECT_TIMEOUT_MS = 3000;
export const RESUME_MS = 5000;
export const OFFER_MS = 5000;
// The brief moment between a fresh game's second joiner arriving and the
// run actually beginning to simulate -- neither INTRO_MS (joining a game
// already running) nor RESUME_MS (restoring a paused one) fit a run's very
// first start, which otherwise jumped straight from "waiting alone" to
// "running" with no announcement at all.
export const STARTING_MS = 2000;

export type CursorRole = "active" | "introducing" | "leaving" | "resuming" | "starting";

// Only these five ever appear in a PlayerView -- spectators, queued, and
// offered visitors are never rendered as players. A type guard so a
// filtered list narrows to CursorRole without a cast.
export function hasCursor(role: Role): role is CursorRole {
  return (
    role === "active" || role === "introducing" || role === "leaving" || role === "resuming" || role === "starting"
  );
}

// Counts toward the simulation (centroid, collisions, the multiplier) --
// only a fully active player, per planning.md's "immediately stop
// contributing" on disconnect and "do not affect the centroid" while
// introducing/resuming.
export function countsTowardSimulation(role: Role): boolean {
  return role === "active";
}

// Occupies one of the 12 active slots, including the ones mid-transition.
export function occupiesSlot(role: Role): boolean {
  return hasCursor(role) || role === "offered";
}

export type RoleDecision = Role | "removed" | null;

// What a connection's role should become given how long it's been idle
// (lastActivityAt) or in its current role (roleChangedAt), given the
// current time -- null means no change. Pure and real-time-independent so
// the exact thresholds are testable without waiting for them.
//
// Staleness is checked ahead of a countdown completing normally: the 3s
// disconnect timeout is shorter than the 5s resume countdown, so a
// resuming connection that goes silent should be treated as disconnected
// rather than activated anyway once 5s happens to pass.
export function nextRole(role: Role, roleChangedAt: number, lastActivityAt: number, now: number): RoleDecision {
  if (
    (role === "active" || role === "introducing" || role === "resuming" || role === "starting") &&
    now - lastActivityAt > DISCONNECT_TIMEOUT_MS
  ) {
    return "leaving";
  }
  if (role === "introducing" && now - roleChangedAt > INTRO_MS) {
    return "active";
  }
  if (role === "resuming" && now - roleChangedAt > RESUME_MS) {
    return "active";
  }
  if (role === "starting" && now - roleChangedAt > STARTING_MS) {
    return "active";
  }
  if (role === "leaving" && now - roleChangedAt > LEAVE_FLASH_MS) {
    return "removed";
  }
  return null;
}

// This connection's own personalized status (protocol.ts's YourView) --
// the only way a spectator or queued visitor, who has no cursor and so no
// entry in `players`, learns its own standing. queued/offered are built
// ad-hoc wherever the queue actually exists (Phase 6); unreachable until
// then since nothing assigns those roles yet.
export function buildYourView(role: Role, roleChangedAt: number, now: number): YourView {
  const remaining = (totalMs: number): number => Math.max(0, totalMs - (now - roleChangedAt));
  switch (role) {
    case "introducing":
      return { role, remainingMs: remaining(INTRO_MS) };
    case "leaving":
      return { role, remainingMs: remaining(LEAVE_FLASH_MS) };
    case "resuming":
      return { role, remainingMs: remaining(RESUME_MS) };
    case "starting":
      return { role, remainingMs: remaining(STARTING_MS) };
    case "active":
      return { role: "active" };
    case "spectator":
    case "queued":
    case "offered":
      return { role: "spectator" };
  }
}
