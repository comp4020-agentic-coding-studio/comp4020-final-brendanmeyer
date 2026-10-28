// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMs, shouldReturnToEntryOnClose, showStatsDialog } from "../src/client/statsDialog.ts";

// Closing the stats dialog goes back to the game if the visitor is still
// actually playing -- the dialog was only ever laid over it. Only a
// connection that was already gone before they opened the dialog sends
// them to the entry screen instead, since there's no live game underneath
// to go back to. Pure function, no DOM needed.
describe("shouldReturnToEntryOnClose", () => {
  it("stays on the game when still connected", () => {
    expect(shouldReturnToEntryOnClose(true)).toBe(false);
  });

  it("goes to the entry screen once the connection was already gone", () => {
    expect(shouldReturnToEntryOnClose(false)).toBe(true);
  });
});

describe("formatMs", () => {
  it("formats minutes and seconds", () => {
    expect(formatMs(65_000)).toBe("1m 5s");
  });

  it("rounds to the nearest second", () => {
    expect(formatMs(500)).toBe("0m 1s");
  });
});

// showStatsDialog does real fetches for its content (stats, records) on
// open -- stubbed here since only the dialog's own open/close/focus/Escape
// behaviour is under test, not what it displays.
function newElements() {
  const overlay = document.createElement("div");
  overlay.hidden = true;
  const closeButton = document.createElement("button");
  const statsEl = document.createElement("dl");
  const recordsEl = document.createElement("tbody");
  const replayCanvas = document.createElement("canvas");
  // jsdom has no real canvas backend -- a fake 2D context is enough since
  // these tests are about open/close/focus/Escape, not what gets drawn.
  vi.spyOn(replayCanvas, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  overlay.append(closeButton);
  document.body.appendChild(overlay);
  return { overlay, closeButton, statsEl, recordsEl, replayCanvas };
}

describe("showStatsDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("moves focus to the close button when opened", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }));
    const elements = newElements();

    void showStatsDialog(elements, () => true);

    expect(document.activeElement).toBe(elements.closeButton);
  });

  it("closes on Escape the same as the close button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }));
    const elements = newElements();

    const result = showStatsDialog(elements, () => true);
    elements.overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(await result).toBe(false); // still connected -- shouldReturnToEntryOnClose(true)
    expect(elements.overlay.hidden).toBe(true);
  });
});
