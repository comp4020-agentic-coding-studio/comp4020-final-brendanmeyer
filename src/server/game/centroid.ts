import type { Vec2 } from "./state.ts";

// Every active player contributes exactly 1/n: a plain mean over however
// many cursor positions are currently active (planning.md section 10).
export function centroid(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
