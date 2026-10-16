import { describe, expect, it } from "vitest";
import { capFood, eatsFood, pickFoodCount, spawnFood, topUpFood } from "../src/server/game/food.ts";
import type { Vec2 } from "../src/server/game/state.ts";

// planning.md section 13: up to `activePlayers` food items can exist at
// once, but spawning intentionally prefers fewer -- weight(k) = 1/2^(k-1)
// for k = 1..activePlayers. An injectable rng (same pattern as
// progression.ts's pickProgression) makes exact boundaries deterministic
// to test rather than asserted statistically. Pure, no running app needed.
describe("pickFoodCount", () => {
  it("is always 1 when there's only one possible choice", () => {
    expect(pickFoodCount(1, () => 0)).toBe(1);
    expect(pickFoodCount(1, () => 0.999)).toBe(1);
  });

  it("picks 1 across most of the roll's range -- the strongly preferred case", () => {
    // n=4: weights [1, 0.5, 0.25, 0.125], total 1.875, so k=1 covers
    // threshold < 1 -- more than half the [0, 1.875) range.
    expect(pickFoodCount(4, () => 0)).toBe(1);
    expect(pickFoodCount(4, () => 0.5)).toBe(1);
  });

  it("only reaches higher counts as the roll approaches its top end", () => {
    // Same n=4 weighting: cumulative thresholds at 0.5333/0.8/0.9333/1.0
    // of the roll's [0,1) range.
    expect(pickFoodCount(4, () => 0.6)).toBe(2);
    expect(pickFoodCount(4, () => 0.85)).toBe(3);
    expect(pickFoodCount(4, () => 0.95)).toBe(4);
  });

  it("never exceeds the active player count", () => {
    expect(pickFoodCount(4, () => 0.999999)).toBe(4);
  });
});

describe("spawnFood", () => {
  const farSnake: Vec2[] = [{ x: 0.01, y: 0.01 }];

  it("avoids existing food, not just the snake", () => {
    // Forced rng: first candidate collides with the existing food item,
    // second candidate is clear.
    const calls: number[] = [0.5, 0.5, 0.9, 0.1];
    let i = 0;
    const rng = () => calls[i++];
    const existing: Vec2[] = [{ x: 0.5, y: 0.5 }];
    const spawned = spawnFood(farSnake, existing, rng);
    expect(spawned).not.toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("eatsFood", () => {
  it("returns the eaten item when the head is within pickup range", () => {
    const food: Vec2[] = [{ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }];
    expect(eatsFood({ x: 0.5, y: 0.5 }, food)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("returns null when nothing is in range", () => {
    const food: Vec2[] = [{ x: 0.9, y: 0.9 }];
    expect(eatsFood({ x: 0.1, y: 0.1 }, food)).toBeNull();
  });

  it("returns null for an empty board", () => {
    expect(eatsFood({ x: 0.5, y: 0.5 }, [])).toBeNull();
  });
});

describe("topUpFood", () => {
  const farSnake: Vec2[] = [{ x: 0.01, y: 0.01 }];

  it("adds items up to the rolled target", () => {
    const result = topUpFood(farSnake, [], 4, () => 0.95); // rolls k=4
    expect(result).toHaveLength(4);
  });

  it("doesn't add more once already at or above the rolled target", () => {
    const existing: Vec2[] = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }];
    const result = topUpFood(farSnake, existing, 2, () => 0); // rolls k=1, already at 2
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(existing));
  });
});

// planning.md section 13: "the maximum number of food items is the number
// of active players" -- a hard cap, not just a spawn-time target. Matters
// when the active count drops (e.g. a disconnect) below food already on
// the board from a larger group; applied every tick, separately from
// topUpFood's weighted (and only pickup-triggered) re-roll.
describe("capFood", () => {
  it("truncates down to the active player count when fewer players remain", () => {
    const existing: Vec2[] = [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.8 }];
    expect(capFood(existing, 2)).toHaveLength(2);
  });

  it("leaves food untouched when already within the cap", () => {
    const existing: Vec2[] = [{ x: 0.2, y: 0.2 }];
    expect(capFood(existing, 4)).toEqual(existing);
  });
});
