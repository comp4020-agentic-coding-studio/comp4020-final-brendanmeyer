import type { Vec2 } from "./state.ts";

// Radians the snake may turn per tick -- small enough that an instant
// 180-degree reversal into itself is impossible (planning.md section 12).
const MAX_TURN_PER_TICK = 0.12;

const SELF_COLLISION_RADIUS = 0.02;

function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Steers smoothly toward the centroid rather than snapping to it.
export function steer(direction: Vec2, target: Vec2, headPosition: Vec2): Vec2 {
  const desired = { x: target.x - headPosition.x, y: target.y - headPosition.y };
  if (Math.hypot(desired.x, desired.y) < 1e-6) return direction;

  const currentAngle = angleOf(direction);
  const desiredAngle = angleOf(desired);
  const delta = normalizeAngle(desiredAngle - currentAngle);
  const clamped = Math.max(-MAX_TURN_PER_TICK, Math.min(MAX_TURN_PER_TICK, delta));
  const newAngle = currentAngle + clamped;
  return { x: Math.cos(newAngle), y: Math.sin(newAngle) };
}

export function advance(snake: Vec2[], newHead: Vec2, grow: boolean): Vec2[] {
  const body = grow ? snake : snake.slice(0, -1);
  return [newHead, ...body];
}

export function hitsWall(point: Vec2): boolean {
  return point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1;
}

// Segments nearest the head are skipped: they're always within the
// collision radius of a continuously curving point just behind it.
export function hitsSelf(head: Vec2, body: Vec2[]): boolean {
  return body
    .slice(3)
    .some((segment) => Math.hypot(segment.x - head.x, segment.y - head.y) < SELF_COLLISION_RADIUS);
}
