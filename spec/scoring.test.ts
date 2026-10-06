import { describe, expect, it } from "vitest";
import { foodEventScore, multiplier } from "../src/shared/scoring.ts";

// Table from planning.md section 14: multiplier(n) = 1 + ((n-2)/10)^2,
// for 2 <= n <= 12 active players. Pure function, no running app needed.
describe("multiplier", () => {
  it("is exactly 1.00 at the 2-player minimum", () => {
    expect(multiplier(2)).toBeCloseTo(1.0, 5);
  });

  it("is exactly 2.00 at the 12-player cap", () => {
    expect(multiplier(12)).toBeCloseTo(2.0, 5);
  });

  it("increases as the group grows", () => {
    expect(multiplier(7)).toBeGreaterThan(multiplier(4));
    expect(multiplier(12)).toBeGreaterThan(multiplier(7));
  });
});

describe("foodEventScore", () => {
  it("rounds the multiplied base score to the nearest whole point", () => {
    expect(foodEventScore(2)).toBe(100);
    expect(foodEventScore(12)).toBe(200);
  });
});
