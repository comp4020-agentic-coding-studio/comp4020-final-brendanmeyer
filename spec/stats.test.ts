import { expect, inject, it } from "vitest";

// planning.md section 22: the public global-stats view. planning.md
// section 19: /api/records lists record-breaking runs in leaderboard
// order. Shape/ordering checks only -- the exact values depend on
// whatever this suite's other tests happened to play, same pragmatic
// limitation as spec/summary.test.ts.
const baseUrl = inject("baseUrl");

it("GET /api/stats answers with the global-stats shape", async () => {
  const res = await fetch(new URL("/api/stats", baseUrl));
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body).toHaveProperty("totalRuns");
  expect(body).toHaveProperty("totalFoodCollected");
  expect(body).toHaveProperty("totalUniquePlayers");
  expect(body).toHaveProperty("totalPlayTimeMs");
  expect(body).toHaveProperty("largestActiveGroup");
  expect(body).toHaveProperty("recordCollectiveScore");
  expect(typeof body.totalRuns).toBe("number");
});

it("GET /api/records answers with record runs in leaderboard order", async () => {
  const res = await fetch(new URL("/api/records", baseUrl));
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  for (const entry of body) {
    expect(entry).toHaveProperty("runId");
    expect(entry).toHaveProperty("collectiveScore");
    expect(entry).toHaveProperty("endedAt");
  }
  for (let i = 1; i < body.length; i++) {
    expect(body[i].collectiveScore).toBeLessThanOrEqual(body[i - 1].collectiveScore);
  }
});
