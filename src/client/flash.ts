// A blink whose frequency ramps over the window -- increasing speed while
// introducing (starts slow, ends fast), decreasing while leaving (starts
// fast, ends slow), per planning.md sections 4 and 5. Returns an opacity
// in [0, 1]; the caller multiplies it into however it draws the cursor.
export type FlashDirection = "increasing" | "decreasing";

const MIN_HZ = 2;
const MAX_HZ = 10;

export function flashAlpha(elapsedMs: number, totalMs: number, direction: FlashDirection): number {
  const t = Math.max(0, Math.min(1, elapsedMs / totalMs));
  const progress = direction === "increasing" ? t : 1 - t;
  const frequencyHz = MIN_HZ + progress * (MAX_HZ - MIN_HZ);
  const phase = (elapsedMs / 1000) * frequencyHz * Math.PI * 2;
  return (Math.sin(phase) + 1) / 2;
}

// Mirrors roles.ts's INTRO_MS/LEAVE_FLASH_MS (both 2000ms) -- duplicated
// rather than shared across the client/server boundary, since the two are
// coincidentally equal, not conceptually the same constant.
const FLASH_WINDOW_MS = 2000;

// Which cursors flash, which way, and for how long -- a player's own
// PlayerView.state is enough to decide, so render.ts doesn't need to know
// the state-to-direction mapping itself.
export function playerFlashAlpha(state: "active" | "introducing" | "leaving" | "resuming", flashMs: number): number {
  if (state === "introducing") return flashAlpha(flashMs, FLASH_WINDOW_MS, "increasing");
  if (state === "leaving") return flashAlpha(flashMs, FLASH_WINDOW_MS, "decreasing");
  return 1;
}
