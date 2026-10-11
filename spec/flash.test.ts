import { describe, expect, it } from "vitest";
import { flashAlpha } from "../src/client/flash.ts";

// planning.md sections 4 and 5: a flashing cursor, increasing in speed
// while introducing, decreasing while leaving. Pure function -- a visual
// effect, so the test pins down the contract (bounded, deterministic,
// doesn't blow up past the window) rather than the exact waveform.
describe("flashAlpha", () => {
  it("stays within [0, 1] throughout the window, both directions", () => {
    for (let ms = 0; ms <= 2000; ms += 50) {
      expect(flashAlpha(ms, 2000, "increasing")).toBeGreaterThanOrEqual(0);
      expect(flashAlpha(ms, 2000, "increasing")).toBeLessThanOrEqual(1);
      expect(flashAlpha(ms, 2000, "decreasing")).toBeGreaterThanOrEqual(0);
      expect(flashAlpha(ms, 2000, "decreasing")).toBeLessThanOrEqual(1);
    }
  });

  it("clamps gracefully past the end of the window instead of blowing up", () => {
    const a = flashAlpha(50_000, 2000, "increasing");
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it("is deterministic for the same inputs", () => {
    expect(flashAlpha(500, 2000, "increasing")).toBe(flashAlpha(500, 2000, "increasing"));
  });

  it("increasing and decreasing differ partway through the window", () => {
    expect(flashAlpha(1000, 2000, "increasing")).not.toBe(flashAlpha(1000, 2000, "decreasing"));
  });
});
