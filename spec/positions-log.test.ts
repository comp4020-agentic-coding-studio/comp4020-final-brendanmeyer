import { describe, expect, it } from "vitest";
import { POSITIONS_LOG_INTERVAL_MS, shouldLogPositions } from "../src/server/game/positionsLog.ts";

// A periodic audit-log line naming every active player and their current
// cursor position, while a game is actually running -- distinct from the
// existing transition events (connect/role-change/food/run-finished),
// which only fire on something happening. Gated the same way
// replay.ts's maybeSample already rate-limits its own periodic sampling:
// a pure, time-injected check rather than a real setInterval, so the
// 30-second boundary is testable without waiting for it.
describe("shouldLogPositions", () => {
  it("doesn't fire before 30 seconds have passed", () => {
    expect(shouldLogPositions(0, POSITIONS_LOG_INTERVAL_MS - 1)).toBe(false);
  });

  it("fires once 30 seconds have passed", () => {
    expect(shouldLogPositions(0, POSITIONS_LOG_INTERVAL_MS)).toBe(true);
  });

  it("fires immediately the first time (never logged yet)", () => {
    expect(shouldLogPositions(null, 0)).toBe(true);
  });
});
