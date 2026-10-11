import { describe, expect, it } from "vitest";
import { createReplayBuffer, maybeSample, takeSamples } from "../src/server/game/replay.ts";

// planning.md section 21: replay data sampled at a server-defined rate
// (10/second suggested) rather than every tick (~15Hz). Pure buffer, no
// running app or real elapsed time needed.
const sample = {
  snakePath: [[0.5, 0.5]] as [number, number][],
  players: [],
  rawScore: 0,
  collectiveScore: 0,
  activeCount: 2,
};

describe("replay sampling", () => {
  it("samples at most once per 100ms", () => {
    const buffer = createReplayBuffer();
    maybeSample(buffer, 0, 0, sample);
    maybeSample(buffer, 50, 0, sample); // too soon, dropped
    maybeSample(buffer, 150, 0, sample); // past the 100ms gate
    expect(takeSamples(buffer)).toHaveLength(2);
  });

  it("records elapsed time relative to the run's start, not absolute time", () => {
    const buffer = createReplayBuffer();
    maybeSample(buffer, 5000, 4000, sample);
    expect(takeSamples(buffer)[0]?.elapsedMs).toBe(1000);
  });

  it("takeSamples clears the buffer", () => {
    const buffer = createReplayBuffer();
    maybeSample(buffer, 0, 0, sample);
    takeSamples(buffer);
    expect(takeSamples(buffer)).toHaveLength(0);
  });
});
