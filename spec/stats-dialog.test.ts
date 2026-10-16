import { describe, expect, it } from "vitest";
import { formatMs, shouldReturnToEntryOnClose } from "../src/client/statsDialog.ts";

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
