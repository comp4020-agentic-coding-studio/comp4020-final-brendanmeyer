import { describe, expect, it } from "vitest";
import { MAX_ACTIVE } from "../src/server/game/roles.ts";
import { activateRole, admit } from "../src/server/game/roster.ts";

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
