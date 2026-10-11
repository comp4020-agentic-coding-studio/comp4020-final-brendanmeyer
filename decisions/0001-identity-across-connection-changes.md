# Identity across a connection change

## Context

A visitor's identity lives behind a token stored in the browser and resolved server-side on every WebSocket handshake. Two different situations can make that token get used a second time while the game is running:

1. **The first connection is still open.** A second tab in the same browser shares `localStorage`, so it resumes the same token while the original tab is still live. This surfaced directly from playing the deployed app: opening a second tab didn't create a second player, it silently became a second connection for the same identity, which breaks the thing the app exists to demonstrate — two *different* people's cursors blending into one snake.
2. **The first connection is actually gone.** The socket closed (tab closed, crash, network drop) and the token is used again later, possibly seconds later, possibly the next day. `planning.md` §5 designs a full answer for this case: a 3-second disconnect timeout, a 2-second flashing cursor before the slot is released, and re-entry through a lobby queue rather than an automatic resume. This case was initially deferred — a 2-player build has no capacity problem for a queue to solve — but is now built in full, alongside the colour reservation (§2), join-introduction flash (§4), 12-player capacity cap and spectator mode (§6), and the FIFO queue itself (§7) that §5's "enter the lobby/queue like any other joining player" depends on. Building §5 honestly requires those neighbours to exist; it can't be answered in isolation.

Both are the same underlying question — what does this token's identity mean right now, given what's happened to its connection — so they're one decision, not two unrelated ones.

## Decision

**Case 1 (still connected elsewhere): offer a takeover, don't silently double up or silently kick.** A hello that resumes a token with a live connection gets `alreadyConnected` instead of `welcome`. The client asks the visitor directly — "already being played in another tab, take over?" — and only on confirmation does the server close the original connection and let the new one proceed as that identity.

**Case 2 (actually disconnected): the full `planning.md` §5 design — timeout, flash, queue re-entry.** A connection with no valid activity (an `input` message or a heartbeat `pong`) for 3 seconds is treated as disconnected: its cursor flashes for 2 seconds as visual-only feedback, then it's removed and its colour released. If at least 2 active players remain the game continues; if fewer remain, the run pauses with its state preserved rather than ending. A reconnecting token keeps its database identity and history but does not reclaim its old slot automatically — it re-enters through the same lobby/queue as any other joining visitor (§6/§7), and gets the slot immediately only if one happens to be free. One interpretation beyond what §5/§7 state verbatim: queueing is opt-in via an explicit "request to join" action, not automatic the instant a visitor becomes a spectator — matching §7's "a declined/expired offer sends you behind currently-waiting spectators if they request to join again," which only makes sense as a repeatable, deliberate action, and means a visitor who only wants to watch is never served an unsolicited 5-second claim window.

## Alternatives considered for Case 1

- **Do nothing** (crit 8's actual behaviour before this fix) — let both connections coexist under the same player ID. Rejected: it lets one visitor open *k* tabs and count as *k* players toward `multiplier(n)`, which is a direct hole in the one thing `README.md` calls out as real rather than decorative — scoring that "actually responds to how many people are playing." It's also confusing on screen: two cursors with the identical name, nothing to explain why.
- **Reject the new connection outright**, no way in from anywhere else. Simpler to build, and closes the scoring hole just as well. Rejected because it turns an ordinary action — switching from a dead laptop to a phone, or just checking a second tab — into a dead end with no recovery path at all, which is a harder failure than anything `planning.md` itself proposes for a real disconnect.
- **Kick the old connection without asking** — newest connection silently wins. Closest to the chosen answer, and avoids an extra round trip. Rejected because the person still in the original tab would watch their game freeze with nothing on screen to explain why, which fails `README.md`'s own bar directly: "without needing any instructions beyond what's on screen."

## Alternatives considered for Case 2

- **Resume immediately, no timeout, no queue** — this build's first answer, kept for the earlier, smaller scope where a 2-player game had no capacity problem for a queue to solve. Superseded once the scope grew to include the 12-player cap and spectator mode: once there's a queue at all, "whoever holds the token resumes instantly, no questions asked" stops being a safe default — it would let a reconnecting visitor skip the queue entirely rather than re-entering through it like §5 specifies, undermining the FIFO ordering §7 exists to guarantee.
- **Resume immediately but silently warn** that history might be stale. Still not worth the extra state once a real timeout exists: a disconnect either resolves within 3 seconds (same participant, no warning needed) or the slot is already gone and re-entry goes through the queue, where there's nothing stale left to warn about.
- **Auto-enqueue every spectator the instant they stop being active**, rather than requiring an explicit request to join. Rejected: it would serve a 5-second claim window to someone who only opened the link to watch, which is a worse "nothing on screen should need explaining" failure than requiring one deliberate click.

## Trade-off accepted

Case 1's answer costs one extra message type and a confirm dialog that a silent approach wouldn't need, and it still lets a confirmed takeover from a different device boot whoever was using the original one. Case 2's answer costs real new surface area — a heartbeat to detect a silent drop at all (a clean `close` is unambiguous, but a dropped connection with no heartbeat would otherwise never be noticed), six more connection states to reason about, and a FIFO queue with its own timers — in exchange for the thing `planning.md` actually specifies: a returning visitor's slot isn't reserved for them, and getting back in means re-entering through the same queue as anyone else, not an automatic resume.

## What would change this

If the 12-player cap and queue are ever removed again (scope shrinking back down, not growing), Case 2's answer should shrink with it — a queue-based re-entry only means something once there's a queue for that slot to matter to.
