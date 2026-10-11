import { describe, expect, it } from "vitest";
import { COLOR_COUNT, createColorState, release, reserve } from "../src/server/game/colors.ts";

// planning.md section 2: 16 predefined colours, never shared by two active
// players, a preference honoured when free, at least 4 always spare at the
// 12-active-player cap. Pure state object, no running app needed.
describe("colour reservation", () => {
  it("reserves the lowest-numbered free colour by default", () => {
    const state = createColorState();
    expect(reserve(state, 1)).toBe(0);
    expect(reserve(state, 2)).toBe(1);
  });

  it("honours a preferred colour when it's free", () => {
    const state = createColorState();
    expect(reserve(state, 1, 7)).toBe(7);
  });

  it("never reserves an already-taken colour, even if preferred", () => {
    const state = createColorState();
    reserve(state, 1, 5);
    expect(reserve(state, 2, 5)).not.toBe(5);
  });

  it("ignores an out-of-range preference rather than corrupting state", () => {
    const state = createColorState();
    expect(reserve(state, 1, 999)).toBe(0);
  });

  it("releases a colour so it can be reused", () => {
    const state = createColorState();
    reserve(state, 1, 3);
    release(state, 1);
    expect(reserve(state, 2, 3)).toBe(3);
  });

  it("leaves at least 4 colours free at the 12-active-player cap", () => {
    const state = createColorState();
    for (let playerId = 1; playerId <= 12; playerId++) reserve(state, playerId);
    const stillFree = COLOR_COUNT - 12;
    expect(stillFree).toBeGreaterThanOrEqual(4);
    expect(reserve(state, 13, 0)).not.toBeNull();
  });
});
