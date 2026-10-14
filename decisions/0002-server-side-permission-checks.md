# Server-side permission checks

## Context

Crit 10's published spec asks for two things together: "what each person may see and change is checked on the server, and that decision is written down in the repo with why." Before writing any new enforcement code, the existing protocol needed auditing for where a server-side check is even necessary.

Every `ClientMessage` the server accepts (`hello`, `input`, `requestJoin`, `acceptOffer`, `declineOffer` — `src/shared/protocol.ts`) carries no field naming another player. Every handler in `src/server/ws.ts` resolves "who is this" from `connections.get(socket)` — the registry keyed by the live socket, not by any client-supplied ID — and acts only on that connection's own `playerId`. A hello's `token` resolves to *a* player, but a confirmed hello is only ever installed as the identity of the socket that sent it (`handleHello`); nothing lets socket A's message change socket B's role, name, cursor, or queue position, because there is no message shape through which A could even name B.

Reads are a separate question from writes, since the whole point of this app is a shared game state everyone needs to see: the live `state` broadcast (`src/server/game/loop.ts`'s `broadcast()`) sends every connected player's position, name, and colour to everyone — correctly, since this is multiplayer Snake, not a private workspace. The one thing that is genuinely one visitor's own data is their run history, served by `GET /api/summary?token=`.

## Decision

**Identity is proven by possession of an opaque per-player token** — the same trust model as a session cookie, not a password-protected account (deliberately out of scope per `CLAUDE.md`, except for the one narrow password-retrieval feature `decisions/0001` already covers). Every mutating action is scoped to `connections.get(socket)`'s own `playerId`; there is no cross-player action to check, because the protocol was built so none exists, rather than building one and then gating it.

**The one per-player-data read, `GET /api/summary?token=`, is gated by the same token.** A request with no token, or an unknown one, gets a safe default (`yourLastRun: null`) rather than an error or someone else's data. A token is only ever sent to the client that owns it — never broadcast, never included in any other player's view of the game.

**Everything else public is public because it genuinely isn't anyone's private data.** `GET /api/stats` and `GET /api/records` are site-wide aggregates; `GET /api/records/:id/replay` is a historical record run's own trajectory, already visible to everyone as the live ghost trail while playing. None of these need a token, and none leak anything a token-gated check would otherwise protect.

## Alternatives considered

- **A full account/role system with server-side ACLs.** Rejected for the same reason `CLAUDE.md` repeatedly defers passwords/auth beyond the one narrow retrieval case: this is a small cooperative game for a handful of people in one sitting, not a system where different users need different permissions over the same data. Building roles and access-control lists for a protocol that structurally has no cross-player actions would be machinery with nothing to protect.
- **Per-message ownership checks sprinkled through each handler** (e.g. `if (msg.playerId !== conn.playerId) return`). Rejected as strictly weaker than what the protocol already guarantees: a check like this can be forgotten on a future message type, where the current approach — no message can even name another player — can't be bypassed by an omission, only by deliberately adding a new field that names one.

## Trade-off accepted

This decision costs nothing additional today, which is itself worth stating plainly: it is a confirmation that the existing design is already correct, not a new restriction layered on top. The cost would show up later, if a future feature genuinely needed one player to act on another's behalf (a kick vote, a moderator role) — at that point a real per-message check would need to be added deliberately, not retrofitted after the fact.

## What would change this

If a feature is ever added that lets one player's action affect another's state directly (not just the shared game state everyone already affects together), that message needs an explicit server-side check of whether the sender is allowed to name that target — and a reason, written down here or in a new decision, the same way this one is.
