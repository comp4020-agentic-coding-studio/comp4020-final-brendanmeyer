// planning.md section 12: on each food pickup the server applies exactly
// one of two bonuses, chosen at random -- never both, never a fixed one.
// rng is injected (the same reasoning food.ts's spawnFood already used
// Math.random for, made explicit here) so both branches are deterministic
// to test rather than asserting on a statistical distribution; the real
// call site passes Math.random.

import { SNAKE_SPEED } from "./state.ts";

export type Progression = "speedUp" | "grow";

// "A default implementation may use an approximately equal chance between
// the two effects" -- a plain 50/50 split on the roll.
export function pickProgression(rng: () => number): Progression {
  return rng() < 0.5 ? "speedUp" : "grow";
}

// Capped "so that the game remains controllable rather than accelerating
// indefinitely" -- twice the starting speed.
export const MAX_SNAKE_SPEED = SNAKE_SPEED * 2;
export const SPEED_STEP = SNAKE_SPEED * 0.1;

export function applySpeedCap(speed: number): number {
  return Math.min(speed, MAX_SNAKE_SPEED);
}
