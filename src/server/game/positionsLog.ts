// A periodic audit-log line naming every active player and their current
// cursor position while a game is running -- distinct from the existing
// transition events (connect/role-change/food/run-finished), which only
// fire on something happening. Gated the same way replay.ts's maybeSample
// already rate-limits its own periodic sampling: a pure, time-injected
// check rather than a real setInterval, so the interval is testable
// without waiting for it.

export const POSITIONS_LOG_INTERVAL_MS = 15_000;

// lastLoggedAt is null before the first log line of a run -- that case
// always fires immediately rather than waiting out a full interval first.
export function shouldLogPositions(lastLoggedAt: number | null, now: number): boolean {
  if (lastLoggedAt === null) return true;
  return now - lastLoggedAt >= POSITIONS_LOG_INTERVAL_MS;
}
