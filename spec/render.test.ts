import { describe, expect, it } from "vitest";
import { shouldDrawSnake } from "../src/client/render.ts";

// A paused run (status "waiting" with a preserved run, planning.md section
// 5's "pauses rather than ends") hides the snake rather than showing it
// frozen mid-board; only the fresh, never-started waiting state still shows
// it at its starting position. Pure function, no DOM needed.
describe("shouldDrawSnake", () => {
  it("hides the snake while waiting on a paused, in-progress run", () => {
    expect(shouldDrawSnake("waiting", true)).toBe(false);
  });

  it("still shows the snake in the fresh, never-started waiting state", () => {
    expect(shouldDrawSnake("waiting", false)).toBe(true);
  });

  it("shows the snake while running or at gameover", () => {
    expect(shouldDrawSnake("running", false)).toBe(true);
    expect(shouldDrawSnake("gameover", false)).toBe(true);
  });
});
