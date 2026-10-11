// The FIFO join queue (planning.md section 7): when a slot opens, the
// longest-waiting spectator gets a join offer with a 5-second claim
// window. A declined or expired offer drops that entry rather than
// requeuing it -- it only re-enters via a fresh request, landing at the
// back. Explicit state object, not module globals, so it's directly
// testable (see spec/queue.test.ts).

import { OFFER_MS } from "./roles.ts";

export interface QueueEntry {
  playerId: number;
}

export interface QueueState {
  waiting: QueueEntry[];
  offer: { entry: QueueEntry; expiresAt: number } | null;
}

export function createQueueState(): QueueState {
  return { waiting: [], offer: null };
}

export function enqueue(state: QueueState, entry: QueueEntry): void {
  state.waiting.push(entry);
}

export function makeOfferIfNeeded(state: QueueState, now: number): QueueEntry | null {
  if (state.offer) return null; // one outstanding offer at a time
  const next = state.waiting.shift();
  if (!next) return null;
  state.offer = { entry: next, expiresAt: now + OFFER_MS };
  return next;
}

export function accept(state: QueueState, playerId: number): QueueEntry | null {
  if (!state.offer || state.offer.entry.playerId !== playerId) return null;
  const entry = state.offer.entry;
  state.offer = null;
  return entry;
}

// Clears the current offer unconditionally and returns the dropped entry,
// if there was one. Used directly for an explicit decline, and by
// expireIfNeeded for an unanswered claim window -- both have the same
// effect, so both funnel through this.
export function dropOffer(state: QueueState): QueueEntry | null {
  if (!state.offer) return null;
  const entry = state.offer.entry;
  state.offer = null;
  return entry;
}

export function expireIfNeeded(state: QueueState, now: number): QueueEntry | null {
  if (!state.offer || now < state.offer.expiresAt) return null;
  return dropOffer(state);
}
