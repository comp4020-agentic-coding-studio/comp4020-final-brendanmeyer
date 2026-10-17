import { describe, expect, it } from "vitest";
import { MAX_ACTIVE } from "../src/server/game/roles.ts";
import { activateRole, admit } from "../src/server/game/roster.ts";

// planning.md sections 4 and 7: joining a game already running gets the
// normal 2s introduction; restoring a paused run gets the 5s resume
// countdown instead. A fresh game (no run in progress) is immediately
// active for the very first joiner (nothing to announce the start of --
// they're alone, waiting), but the second joiner -- the one whose arrival
// is what actually starts the run -- gets a brief "starting" announcement
// instead of snapping straight into a moving game. Pure decision, shared
// by a direct hello and an accepted queue offer (Phase 6) so both go
// through the same logic.
describe("activateRole", () => {
  it("is immediately active for the very first joiner -- nobody else is there yet to start with", () => {
    expect(activateRole("waiting", false, 0)).toBe("active");
  });

  it("starts the game for the second joiner, rather than jumping straight to active", () => {
    expect(activateRole("waiting", false, 1)).toBe("starting");
  });

  it("is immediately active for a third+ joiner once the game is already past starting", () => {
    expect(activateRole("waiting", false, 2)).toBe("active");
  });

  it("introduces a player joining a game already running, regardless of occupied slots", () => {
    expect(activateRole("running", false, 1)).toBe("introducing");
    expect(activateRole("running", false, 5)).toBe("introducing");
  });

  it("resumes a player restoring a paused run instead of starting or introducing them", () => {
    expect(activateRole("waiting", true, 1)).toBe("resuming");
  });

  it("is immediately active at gameover when it isn't the one bringing the count to two", () => {
    expect(activateRole("gameover", false, 0)).toBe("active");
  });

  it("still starts the run at gameover if this join is the one bringing the count to two -- same as a fresh waiting game", () => {
    expect(activateRole("gameover", false, 1)).toBe("starting");
  });
});

// planning.md section 6: beyond the 12-active-player cap, a visitor
// becomes a spectator instead of whatever activateRole alone would have
// decided. occupiedSlots is passed in (not read from ws.ts's connections
// map) so this stays a pure, directly testable decision.
describe("admit", () => {
  it("activates normally under the cap", () => {
    expect(admit(MAX_ACTIVE - 1, "waiting", false)).toBe("active");
  });

  it("becomes a spectator once the cap is reached", () => {
    expect(admit(MAX_ACTIVE, "waiting", false)).toBe("spectator");
  });

  it("is a spectator even when the game would otherwise introduce or resume", () => {
    expect(admit(MAX_ACTIVE, "running", false)).toBe("spectator");
    expect(admit(MAX_ACTIVE, "waiting", true)).toBe("spectator");
  });
});
