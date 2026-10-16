import type { Vec2 } from "./state.ts";

const FOOD_PICKUP_RADIUS = 0.03;
const SPAWN_MARGIN = 0.08;
const MAX_SPAWN_ATTEMPTS = 50;

// planning.md section 13: up to `activePlayers` food items may exist at
// once, but spawning intentionally prefers fewer -- weight(k) = 1/2^(k-1)
// for k = 1..activePlayers, normalized into a probability distribution and
// picked via the injected rng (same pattern as progression.ts's
// pickProgression) so exact boundaries are deterministic to test rather
// than asserted statistically.
export function pickFoodCount(activePlayers: number, rng: () => number): number {
  const weights: number[] = [];
  for (let k = 1; k <= activePlayers; k++) weights.push(1 / 2 ** (k - 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (let k = 1; k <= activePlayers; k++) {
    cumulative += weights[k - 1];
    if (roll < cumulative) return k;
  }
  return activePlayers;
}

// Rejects candidates inside the snake or any existing food item; after
// enough failed attempts falls back to the centre, which is always clear
// on a fresh run. rng is injectable the same way pickFoodCount's is, so a
// forced collide-then-clear sequence is testable without relying on real
// randomness landing where a test needs it.
export function spawnFood(snake: Vec2[], existingFood: Vec2[] = [], rng: () => number = Math.random): Vec2 {
  for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
    const candidate: Vec2 = {
      x: SPAWN_MARGIN + rng() * (1 - 2 * SPAWN_MARGIN),
      y: SPAWN_MARGIN + rng() * (1 - 2 * SPAWN_MARGIN),
    };
    const collidesWithSnake = snake.some(
      (segment) => Math.hypot(segment.x - candidate.x, segment.y - candidate.y) < FOOD_PICKUP_RADIUS * 2,
    );
    const collidesWithFood = existingFood.some(
      (item) => Math.hypot(item.x - candidate.x, item.y - candidate.y) < FOOD_PICKUP_RADIUS * 2,
    );
    if (!collidesWithSnake && !collidesWithFood) return candidate;
  }
  return { x: 0.5, y: 0.5 };
}

// planning.md section 13: "the maximum number of food items is the number
// of active players" -- a hard cap, separate from the weighted spawn
// target below, and cheap enough to apply every tick regardless of
// whether anything was just eaten. Matters when the active set shrinks
// (e.g. a disconnect) and leaves more food on the board than the new,
// smaller count allows.
export function capFood(food: Vec2[], activePlayers: number): Vec2[] {
  return food.length > activePlayers ? food.slice(0, activePlayers) : food;
}

// Tops the board up to pickFoodCount's freshly-rolled target -- only ever
// called alongside an actual pickup (or the first spawn of a run), not
// every tick, so an idle board's count doesn't fluctuate on its own.
// Assumes capFood has already run; this only ever adds.
export function topUpFood(snake: Vec2[], currentFood: Vec2[], activePlayers: number, rng: () => number = Math.random): Vec2[] {
  const food = [...currentFood];
  const target = pickFoodCount(activePlayers, rng);
  while (food.length < target) {
    food.push(spawnFood(snake, food, rng));
  }
  return food;
}

// Returns the first food item within pickup range, or null if nothing is.
// Only one item can realistically be eaten in a single tick -- the head is
// a single point -- so there's no ordering concern among several in range
// at once (planning.md section 15's deterministic tick order is about
// cross-player ordering, not same-tick multi-item ties).
export function eatsFood(head: Vec2, food: Vec2[]): Vec2 | null {
  return food.find((item) => Math.hypot(head.x - item.x, head.y - item.y) < FOOD_PICKUP_RADIUS) ?? null;
}
