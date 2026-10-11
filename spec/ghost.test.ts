import { describe, expect, it } from "vitest";
import { createGhostState, currentGhostFrame } from "../src/client/ghost.ts";

// The ghost replay loops on its own local clock (planning.md section 21),
// independent of the live game's tick. Pure function over a fixed sample
// array, no fetch or DOM needed.
describe("currentGhostFrame", () => {
  it("returns null when disabled or there are no samples", () => {
    const state = createGhostState();
    expect(currentGhostFrame(state, 100)).toBe(null);
    state.enabled = false;
    state.samples = [{ elapsedMs: 0, snakePath: [], players: [] }];
    expect(currentGhostFrame(state, 100)).toBe(null);
  });

  it("picks the latest sample at or before the looped time", () => {
    const state = createGhostState();
    state.samples = [
      { elapsedMs: 0, snakePath: [[0, 0]], players: [] },
      { elapsedMs: 100, snakePath: [[1, 1]], players: [] },
      { elapsedMs: 200, snakePath: [[2, 2]], players: [] },
    ];
    expect(currentGhostFrame(state, 50)?.snakePath).toEqual([[0, 0]]);
    expect(currentGhostFrame(state, 150)?.snakePath).toEqual([[1, 1]]);
  });

  it("loops back to the start once past the replay's total duration", () => {
    const state = createGhostState();
    state.samples = [
      { elapsedMs: 0, snakePath: [[0, 0]], players: [] },
      { elapsedMs: 100, snakePath: [[1, 1]], players: [] },
    ];
    // now=250 wraps to 50 within a 100ms-long replay -- back near the start.
    expect(currentGhostFrame(state, 250)?.snakePath).toEqual([[0, 0]]);
  });
});
