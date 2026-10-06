import type { Vec2 } from "./state.ts";

const FOOD_PICKUP_RADIUS = 0.03;
const SPAWN_MARGIN = 0.08;
const MAX_SPAWN_ATTEMPTS = 50;

// Rejects candidates inside the snake; after enough failed attempts falls
// back to the centre, which is always clear on a fresh run.
export function spawnFood(snake: Vec2[]): Vec2 {
  for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
    const candidate: Vec2 = {
      x: SPAWN_MARGIN + Math.random() * (1 - 2 * SPAWN_MARGIN),
      y: SPAWN_MARGIN + Math.random() * (1 - 2 * SPAWN_MARGIN),
    };
    const collidesWithSnake = snake.some(
      (segment) => Math.hypot(segment.x - candidate.x, segment.y - candidate.y) < FOOD_PICKUP_RADIUS * 2,
    );
    if (!collidesWithSnake) return candidate;
  }
  return { x: 0.5, y: 0.5 };
}

export function eatsFood(head: Vec2, food: Vec2 | null): boolean {
  return food !== null && Math.hypot(head.x - food.x, head.y - food.y) < FOOD_PICKUP_RADIUS;
}
