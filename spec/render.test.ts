import { describe, expect, it } from "vitest";
import { shouldDrawSnake } from "../src/client/render.ts";

// A waiting game never shows the snake -- the only thing on screen while
// waiting is the overlay text ("Waiting for a second player" / "Starting"),
// and a snake drawn underneath it (at its starting position, or frozen mid-
// board for a paused, in-progress run) made that text hard to read. Pure
// function, no DOM needed.
describe("shouldDrawSnake", () => {
  it("hides the snake in the fresh, never-started waiting state", () => {
    expect(shouldDrawSnake("waiting")).toBe(false);
  });

  it("hides the snake while waiting on a paused, in-progress run", () => {
    expect(shouldDrawSnake("waiting")).toBe(false);
  });

  it("shows the snake while running or at gameover", () => {
    expect(shouldDrawSnake("running")).toBe(true);
    expect(shouldDrawSnake("gameover")).toBe(true);
  });
});
