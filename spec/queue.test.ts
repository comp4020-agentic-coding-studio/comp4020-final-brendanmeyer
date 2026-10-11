import { describe, expect, it } from "vitest";
import { accept, createQueueState, dropOffer, enqueue, expireIfNeeded, makeOfferIfNeeded } from "../src/server/game/queue.ts";
import { OFFER_MS } from "../src/server/game/roles.ts";

// planning.md section 7: FIFO queue, a 5s claim window per offer, and a
// declined/expired offer drops the entry rather than requeuing it -- it
// only re-enters via a fresh request, landing at the back. Pure state
// object (not module globals), no running app or real elapsed time needed.
describe("queue", () => {
  it("offers the longest-waiting entry first", () => {
    const state = createQueueState();
    enqueue(state, { playerId: 1 });
    enqueue(state, { playerId: 2 });
    expect(makeOfferIfNeeded(state, 0)?.playerId).toBe(1);
  });

  it("doesn't make a second offer while one is already outstanding", () => {
    const state = createQueueState();
    enqueue(state, { playerId: 1 });
    enqueue(state, { playerId: 2 });
    makeOfferIfNeeded(state, 0);
    expect(makeOfferIfNeeded(state, 0)).toBe(null);
  });

  it("accepting the current offer returns it and clears it", () => {
    const state = createQueueState();
    enqueue(state, { playerId: 1 });
    makeOfferIfNeeded(state, 0);
    expect(accept(state, 1)?.playerId).toBe(1);
    expect(accept(state, 1)).toBe(null); // already cleared, nothing left to accept
  });

  it("accepting with the wrong playerId does nothing", () => {
    const state = createQueueState();
    enqueue(state, { playerId: 1 });
    makeOfferIfNeeded(state, 0);
    expect(accept(state, 999)).toBe(null);
  });

  it("an offer expires after its claim window, dropping rather than requeuing the entry", () => {
    const state = createQueueState();
    enqueue(state, { playerId: 1 });
    enqueue(state, { playerId: 2 });
    makeOfferIfNeeded(state, 0);
    expect(expireIfNeeded(state, OFFER_MS - 1)).toBe(null);
    expect(expireIfNeeded(state, OFFER_MS + 1)?.playerId).toBe(1);
    // player 1 is gone, not back in the queue -- the next offer goes to 2
    expect(makeOfferIfNeeded(state, OFFER_MS + 1)?.playerId).toBe(2);
  });

  it("an explicit decline drops the offer the same way an expiry does", () => {
    const state = createQueueState();
    enqueue(state, { playerId: 1 });
    makeOfferIfNeeded(state, 0);
    expect(dropOffer(state)?.playerId).toBe(1);
    expect(state.waiting.length).toBe(0); // not requeued
  });
});
