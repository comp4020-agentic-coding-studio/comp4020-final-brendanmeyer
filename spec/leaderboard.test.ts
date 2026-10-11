import { describe, expect, it } from "vitest";
import { isNewRecord, sortRecords } from "../src/shared/leaderboard.ts";

// planning.md section 19: leaderboard order is collective_score descending,
// and an exact tie keeps the run that reached it first on top -- a later
// tied score never displaces the original record-holder. Pure functions so
// an exact tie can be hand-constructed; producing one through real
// gameplay isn't practical (same reasoning as spec/scoring.test.ts).
describe("isNewRecord", () => {
  it("is a new record when strictly higher than the previous best", () => {
    expect(isNewRecord(150, 100)).toBe(true);
  });

  it("is not a new record on an exact tie", () => {
    expect(isNewRecord(100, 100)).toBe(false);
  });

  it("is not a new record when lower", () => {
    expect(isNewRecord(80, 100)).toBe(false);
  });

  it("any score is a record when there's no previous best yet", () => {
    expect(isNewRecord(1, null)).toBe(true);
  });
});

describe("sortRecords", () => {
  it("orders by collective score descending", () => {
    const rows = [
      { id: 1, collectiveScore: 100, endedAt: 10 },
      { id: 2, collectiveScore: 200, endedAt: 20 },
    ];
    expect(sortRecords(rows).map((r) => r.id)).toEqual([2, 1]);
  });

  it("breaks an exact tie by chronological priority -- the earlier run keeps the higher position", () => {
    const rows = [
      { id: 1, collectiveScore: 100, endedAt: 20 },
      { id: 2, collectiveScore: 100, endedAt: 10 },
    ];
    expect(sortRecords(rows).map((r) => r.id)).toEqual([2, 1]);
  });
});
