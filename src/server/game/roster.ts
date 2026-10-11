import type { GameState } from "./state.ts";
import type { Role } from "./roles.ts";

// What role a newly-registered connection starts in (planning.md sections
// 4 and 7): the normal 2s join introduction when joining a game already
// running, the 5s resume countdown when restoring a paused run, or
// immediately active otherwise (no run in progress to disrupt). Pure, so a
// direct hello and an accepted queue offer (Phase 6) can share it instead
// of duplicating the decision.
export function activateRole(status: GameState["status"], pausedWithRun: boolean): Role {
  if (pausedWithRun) return "resuming";
  if (status === "running") return "introducing";
  return "active";
}
