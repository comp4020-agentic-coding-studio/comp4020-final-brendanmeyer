// The group-size multiplier applied to every food event's collective score.
// multiplier(n) = 1 + ((n - 2) / 10)^2, for 2 <= n <= 12 active players
// (planning.md section 14): an increasing-returns curve, deliberately
// rewarding bigger groups rather than tapering off as they grow.

export function multiplier(activePlayers: number): number {
  return 1 + ((activePlayers - 2) / 10) ** 2;
}

export const BASE_FOOD_POINTS = 100;

// A single food event's contribution to the collective score, rounded to
// the nearest whole point.
export function foodEventScore(activePlayers: number): number {
  return Math.round(BASE_FOOD_POINTS * multiplier(activePlayers));
}
