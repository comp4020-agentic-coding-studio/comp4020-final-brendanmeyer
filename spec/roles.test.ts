import { describe, expect, it } from "vitest";
import { DISCONNECT_TIMEOUT_MS, INTRO_MS, LEAVE_FLASH_MS, nextRole, RESUME_MS } from "../src/server/game/roles.ts";

// planning.md section 5's two timing rules, pure and real-time-independent:
// no activity for 3 seconds starts the leaving flash; the flash lasts 2
// seconds before full removal. Tested against fabricated timestamps rather
// than real elapsed time, since the exact threshold is the thing being
// verified -- a real socket test can't reliably force a genuinely silent
// drop on localhost (see spec/disconnect-timeout.test.ts for what that file
// covers instead: the clean-close path, which a real socket can prove).
describe("nextRole", () => {
  it("leaves an active connection alone right up to the disconnect timeout", () => {
    expect(nextRole("active", 0, 1000, 1000 + DISCONNECT_TIMEOUT_MS)).toBe(null);
  });

  it("marks an active connection leaving once the disconnect timeout elapses", () => {
    expect(nextRole("active", 0, 1000, 1000 + DISCONNECT_TIMEOUT_MS + 1)).toBe("leaving");
  });

  it("applies the same timeout to introducing and resuming connections", () => {
    expect(nextRole("introducing", 0, 1000, 1000 + DISCONNECT_TIMEOUT_MS + 1)).toBe("leaving");
    expect(nextRole("resuming", 0, 1000, 1000 + DISCONNECT_TIMEOUT_MS + 1)).toBe("leaving");
  });

  it("never times out a spectator, queued, or offered connection -- they have no cursor to lose", () => {
    expect(nextRole("spectator", 0, 0, 1_000_000)).toBe(null);
    expect(nextRole("queued", 0, 0, 1_000_000)).toBe(null);
    expect(nextRole("offered", 0, 0, 1_000_000)).toBe(null);
  });

  it("leaves a leaving connection alone right up to the flash duration", () => {
    expect(nextRole("leaving", 1000, 1000, 1000 + LEAVE_FLASH_MS)).toBe(null);
  });

  it("removes a leaving connection once the flash duration elapses", () => {
    expect(nextRole("leaving", 1000, 1000, 1000 + LEAVE_FLASH_MS + 1)).toBe("removed");
  });

  it("completes the join introduction after 2 seconds, becoming active", () => {
    expect(nextRole("introducing", 1000, 1000, 1000 + INTRO_MS - 1)).toBe(null);
    expect(nextRole("introducing", 1000, 1000, 1000 + INTRO_MS + 1)).toBe("active");
  });

  it("completes the paused-game resume countdown after 5 seconds, becoming active", () => {
    expect(nextRole("resuming", 1000, 1000, 1000 + RESUME_MS - 1)).toBe(null);
    expect(nextRole("resuming", 1000, 1000, 1000 + RESUME_MS + 1)).toBe("active");
  });

  it("treats a resuming connection as disconnected if it goes stale before the resume completes", () => {
    // 3s staleness is shorter than the 5s resume countdown -- silence
    // should win, not an automatic activation at 5s regardless.
    expect(nextRole("resuming", 1000, 1000, 1000 + DISCONNECT_TIMEOUT_MS + 1)).toBe("leaving");
  });
});
