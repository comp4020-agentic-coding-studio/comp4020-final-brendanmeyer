# Identity across a connection change

## Context

A visitor's identity lives behind a token stored in the browser and resolved server-side on every WebSocket handshake. Two different situations can make that token get used a second time while the game is running:

1. **The first connection is still open.** A second tab in the same browser shares `localStorage`, so it resumes the same token while the original tab is still live. This surfaced directly from playing the deployed app: opening a second tab didn't create a second player, it silently became a second connection for the same identity, which breaks the thing the app exists to demonstrate — two *different* people's cursors blending into one snake.
2. **The first connection is actually gone.** The socket closed (tab closed, crash, network drop) and the token is used again later, possibly seconds later, possibly the next day. `planning.md` §5 designs a full answer for this case: a 3-second disconnect timeout, a 2-second flashing cursor before the slot is released, and re-entry through a lobby queue rather than an automatic resume. None of that is built. `README.md` already names a grace period before someone is counted as gone as something still to come, and the 12-player lobby/queue is out of scope for the same reason the 2-player build doesn't have a capacity problem yet.

Both are the same underlying question — what does this token's identity mean right now, given what's happened to its connection — so they're one decision, not two unrelated ones.

## Decision

**Case 1 (still connected elsewhere): offer a takeover, don't silently double up or silently kick.** A hello that resumes a token with a live connection gets `alreadyConnected` instead of `welcome`. The client asks the visitor directly — "already being played in another tab, take over?" — and only on confirmation does the server close the original connection and let the new one proceed as that identity.

**Case 2 (actually disconnected): resume immediately, no timeout, no queue.** The moment a token with no live connection is presented again, it just resumes — the same behaviour crit 8 already had. The fuller `planning.md` §5 design (timeout, flashing, queue re-entry) is deliberately not built this week.

## Alternatives considered for Case 1

- **Do nothing** (crit 8's actual behaviour before this fix) — let both connections coexist under the same player ID. Rejected: it lets one visitor open *k* tabs and count as *k* players toward `multiplier(n)`, which is a direct hole in the one thing `README.md` calls out as real rather than decorative — scoring that "actually responds to how many people are playing." It's also confusing on screen: two cursors with the identical name, nothing to explain why.
- **Reject the new connection outright**, no way in from anywhere else. Simpler to build, and closes the scoring hole just as well. Rejected because it turns an ordinary action — switching from a dead laptop to a phone, or just checking a second tab — into a dead end with no recovery path at all, which is a harder failure than anything `planning.md` itself proposes for a real disconnect.
- **Kick the old connection without asking** — newest connection silently wins. Closest to the chosen answer, and avoids an extra round trip. Rejected because the person still in the original tab would watch their game freeze with nothing on screen to explain why, which fails `README.md`'s own bar directly: "without needing any instructions beyond what's on screen."

## Alternatives considered for Case 2

- **Build `planning.md` §5 in full now** (timeout, flashing, queue) since the design for it already exists. Rejected for this week specifically: a 2-player build has no capacity problem for a queue to solve, and adding the timeout/flashing machinery now would be reaching for a deferred invariant just because it's easy to reach for while already in this file — not because this week's scope needs it.
- **Resume immediately but silently warn** that history might be stale. Not worth the extra state for a 2-player game that resets a run in seconds; there is nothing stale to warn about at this scale yet.

## Trade-off accepted

Case 1's answer costs one extra message type and a confirm dialog that a silent approach wouldn't need, and it still lets a confirmed takeover from a different device boot whoever was using the original one — a true multi-device-safe design might handle that differently, but that's `planning.md`'s queue-based re-entry, deliberately still out of scope. Case 2's answer means a run that was still "yours" a second ago can be resumed by literally anyone who still has the token, with no window in which a slot is reserved for you specifically — acceptable now because nothing in this build's scope depends on that window existing yet.

## What would change this

Building the lobby/queue (crit 9's own scope list keeps it deferred) would also be the point to revisit Case 2: a timeout and a reserved slot only mean something once there's a queue for that slot to matter to.
