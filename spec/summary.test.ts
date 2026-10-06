import { expect, inject, it } from "vitest";

// GET /api/summary is how a returning visitor sees their own trace: this
// week's persistence contract. Runs against the real, deployed-shape app
// spec/global-setup.ts finds, same as invariants.test.ts.
const baseUrl = inject("baseUrl");

it("answers with the shape a returning visitor needs", async () => {
  const res = await fetch(new URL("/api/summary", baseUrl));
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body).toHaveProperty("yourLastRun");
  expect(body).toHaveProperty("allTimeBest");
  expect(body).toHaveProperty("totalRuns");
  expect(typeof body.totalRuns).toBe("number");
});
