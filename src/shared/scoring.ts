// The group-size multiplier applied to every food event's collective score.
// multiplier(n) = 1 + ((n - 2) / 10)^2, for 2 <= n <= 12 active players
// (planning.md section 14). Not implemented yet: spec/scoring.test.ts
// drives this, and should currently fail.

export function multiplier(_activePlayers: number): number {
  throw new Error("multiplier() not implemented yet");
}

export const BASE_FOOD_POINTS = 100;

// A single food event's contribution to the collective score, rounded to
// the nearest whole point.
export function foodEventScore(activePlayers: number): number {
  return Math.round(BASE_FOOD_POINTS * multiplier(activePlayers));
}
