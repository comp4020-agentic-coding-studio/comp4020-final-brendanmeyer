import { describe, expect, it } from "vitest";
import { applySpeedCap, MAX_SNAKE_SPEED, pickProgression, SPEED_STEP } from "../src/server/game/progression.ts";

// planning.md section 12: on each food pickup the server randomly applies
// ONE of two progression bonuses -- speed up, or grow -- never both. An
// injectable rng (the same pattern food.ts's spawnFood already used
// inline, made explicit here) makes both branches deterministic to test,
// rather than asserting on a statistical distribution. Pure, no running
// app needed.
describe("pickProgression", () => {
  it("picks speedUp for the low half of the roll", () => {
    expect(pickProgression(() => 0)).toBe("speedUp");
    expect(pickProgression(() => 0.49)).toBe("speedUp");
  });

  it("picks grow for the high half of the roll", () => {
    expect(pickProgression(() => 0.5)).toBe("grow");
    expect(pickProgression(() => 0.999)).toBe("grow");
  });
});

describe("applySpeedCap", () => {
  it("leaves a speed below the cap unchanged", () => {
    expect(applySpeedCap(MAX_SNAKE_SPEED - SPEED_STEP)).toBeCloseTo(MAX_SNAKE_SPEED - SPEED_STEP, 10);
  });

  it("clamps a speed at or above the cap", () => {
    expect(applySpeedCap(MAX_SNAKE_SPEED)).toBeCloseTo(MAX_SNAKE_SPEED, 10);
    expect(applySpeedCap(MAX_SNAKE_SPEED + SPEED_STEP)).toBeCloseTo(MAX_SNAKE_SPEED, 10);
  });
});
