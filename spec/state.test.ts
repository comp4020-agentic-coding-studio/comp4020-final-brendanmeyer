import { describe, expect, it } from "vitest";
import { freshState } from "../src/server/game/state.ts";

// pausedWithRun distinguishes "never started" from "was running, dropped
// below 2 players" -- needed so the join-introduction flash (planning.md
// section 4) and the paused-game resume countdown (section 7) don't both
// collapse into the existing "two fresh sessions start immediately" path.
// Pure function, no running app needed.
describe("freshState", () => {
  it("starts with pausedWithRun false", () => {
    expect(freshState().pausedWithRun).toBe(false);
  });
});
