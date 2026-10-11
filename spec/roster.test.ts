import { describe, expect, it } from "vitest";
import { activateRole } from "../src/server/game/roster.ts";

// planning.md sections 4 and 7: joining a game already running gets the
// normal 2s introduction; restoring a paused run gets the 5s resume
// countdown instead; anything else (no game running yet) is immediately
// active. Pure decision, shared by a direct hello and an accepted queue
// offer (Phase 6) so both go through the same logic.
describe("activateRole", () => {
  it("is immediately active when no run is in progress", () => {
    expect(activateRole("waiting", false)).toBe("active");
  });

  it("introduces a player joining a game already running", () => {
    expect(activateRole("running", false)).toBe("introducing");
  });

  it("resumes a player restoring a paused run instead of introducing them", () => {
    expect(activateRole("waiting", true)).toBe("resuming");
  });

  it("is immediately active at gameover -- the next run hasn't started yet", () => {
    expect(activateRole("gameover", false)).toBe("active");
  });
});
