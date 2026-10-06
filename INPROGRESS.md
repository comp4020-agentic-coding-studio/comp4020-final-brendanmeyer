# Process

## Starting from the brief

The [final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/) asks for an app that is multi-user, real-time (changes propagate to other open sessions in about a second, no reload), and persistent across sessions, restarts and redeploys, deployed to a single Fly.io machine with one volume. It also asks for a definition of "good" that I make and defend myself, rather than one handed to me.

The repo ships with no starter app, just a placeholder that serves one page and `README.md` at `/readme/` [874688a](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/874688aeed740ba499fa46a2e227ee12d52caab9). The stack, schema and interaction are entirely my own choice to make and justify here.

## First approach: a design document before any code

Rather than start writing the server, I wrote out the game design in full as `planning.md` [1c700a4](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/1c700a4a5f9fd45a24ae1fd76575c73ae75862cb): a Snake variant where no single player controls the snake directly. Every active player controls a cursor, and the snake steers toward the centroid of all active cursors, weighted at exactly `1/n` per player. The design states this explicitly as the point: "the game therefore cannot meaningfully be played alone," which is a direct answer to the brief's multi-user requirement - multi-user isn't bolted on as an identity/session layer, it's the mechanic itself.

That first pass covered player identity, join/leave behaviour with a 2-second introduction window, a 12-player cap with lobby/spectator mode, no in-game chat (coordination happens through cursor movement), persistence of run history and a "ghost trail" of the record run, a first scoring model, and a server-authoritative simulation loop.

## Refining the scoring model

The first draft's participation scoring had an unresolved placeholder ("make the calcuation different for each play, so they cannot compare...") and left the group-size multiplier formula unspecified beyond "should increase gradually." That placeholder wasn't a considered position, just a marker that something had to go there so the first iteration was complete enough to react to - the actual rule came later.

The second pass [5aa3629](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/5aa362971206c730e3bd2b72257f116d15d28bf0) resolved it:

- scoring was split into a **raw score** (snake progression only) and a **collective score** (raw × a group-size multiplier), computed **per food event** rather than once at the end of a run, specifically so a player joining late can't retroactively inflate points earned before they arrived;
- the multiplier was pinned to a concrete formula, `multiplier(n) = 1 + ((n - 2) / 10)^2`, an **increasing**-returns curve (going from 2→4 players barely moves the multiplier, but 10→12 does) rather than a diminishing-returns shape. This was deliberate, not a reinterpretation of "gradual": the goal is to incentivise bigger groups, and coordinating a large group with no chat is harder than coordinating a small one, so the reward for pulling it off should grow with the group rather than taper off;
- "active player" was given a single definition reused by both the centroid and the multiplier - joining/introduction, disconnected/flashing, and stale/timed-out players all explicitly don't count toward either.

## Expanding into identity, queueing and replay

The third pass [7bf1793](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/7bf17932daf062f6430e00d5a4877feda433bc89) is substantially larger than the first two combined (600 insertions) and adds several subsystems the first draft didn't have:

- persistent accounts with an optional password (hashed, never stored plaintext, no reset flow) so a pseudonym can survive a browser session ending, not just a page refresh;
- a FIFO lobby queue with a 5-second claim window for the 13th-and-later visitor, replacing the first draft's unspecified "may enter the active game";
- a deterministic per-tick event order (connection state → active-player set → input → centroid → movement → collisions → scoring → spawn → broadcast), so a join or disconnect landing on the same tick as a food collection has a defined outcome instead of a race;
- ghost-trail replay of the record run at a fixed sample rate, and explicit rules that ties in the leaderboard resolve to whichever run reached the score first.

This reads as closing gaps the first two passes left implicit (what happens at the capacity boundary, what happens when two things occur on the same tick) by making the server-authoritative claim in section 12 of the original draft concrete enough to implement against. The motivation for going this far before writing any code was general rather than specific to this project: a well-thought-out base is worth having before starting, since it's what keeps the build on track rather than drifting as problems come up mid-implementation.

## Choosing what to build this week, not the whole design

`planning.md`'s 40 invariants are the full game; crit 8 only asks for proof of life. `CLAUDE.md` [eef072d](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/eef072d) and `README.md` [0ec4f0c](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/0ec4f0c) state, before any server code existed, what this week's slice actually commits to: real centroid steering and real scoring between two active sessions, a persisted per-visitor trace, and the 2-player minimum held from the first commit that has a game loop at all — invariant 40 explicitly bans a single-player fallback, so relaxing that minimum "temporarily" was never on the table. Everything else `planning.md` describes (passwords, the lobby queue, ghost trails, participation scoring, and more) is named and deferred rather than half-built.

New `spec/*.test.ts` checks were written against that scope next [bd39395](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/bd39395), before the server code they test existed, and confirmed red for the right reason (nothing listening yet) rather than skipped past.

## Persistence: `node:sqlite` over a native driver

[`4398aa1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/4398aa1) adds the DB layer on Node's built-in `node:sqlite` module (`DatabaseSync`) rather than `better-sqlite3`. The deciding factor was the Docker build: Fly's one machine has no separate database server, so everything durable lives in SQLite on the one mounted volume, and `node:sqlite` needs no native compilation step to get there — `better-sqlite3` would need node-gyp in the image for one dependency. The trade-off, recorded honestly rather than glossed over: Node's own docs still mark it "Stability: 1.2 — release candidate," not fully stable. That's mitigated by sticking to its narrowest, longest-settled surface (`exec`, `prepare().run/get/all`) and nothing more exotic.

## Schema: the smallest thing that can prove persistence

Three tables: `players`, `runs`, `run_players`. This is a strict subset of the ~20-field persistence model `planning.md` section 20 describes — no food event logs, no replay sampling, no participation records yet — and nothing in it needs to be migrated away later, only added to.

One addition beyond what was originally scoped: a `token` column on `players`, generated when a pseudonym is claimed and meant to be kept client-side (`localStorage`), because `GET /api/summary` needs a way to find *this* visitor's last run specifically, not just a global number — that's the difference between "a trace is still there" and "a counter went up somewhere."

## Server: plain `node:http` + `ws`, no build step

[`7b1bb70`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/7b1bb70) runs the server as `node src/server/index.ts` directly, rather than through a framework or a compiled output. Node 24.21 (pinned in `mise.toml`) has had type stripping stable since 24.12, and `tsconfig.json`'s own `allowImportingTsExtensions` comment was already pointing at exactly this. This week's server is a handful of routes plus one WebSocket upgrade ([`1a421e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/1a421e8)) — Express or Fastify would add a dependency tree and a routing abstraction the app doesn't need yet, for no benefit at this size. `ws` is the plain, widely-used WebSocket implementation; its optional native speed-up packages are allowed to fail silently on install, so it doesn't reopen the native-build problem the `node:sqlite` choice was specifically avoiding.

Real-time transport is a WebSocket, not polling or server-sent events, because the thing actually being proven this week — two sessions' cursor input converging into one steered snake ([`1b232b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/1b232b0)) — needs a bidirectional, low-latency channel; SSE has no client-to-server leg, and polling at the ~15Hz the loop ticks would be both laggier and wasteful.

## Client: a real build step, vanilla canvas

The server can skip a build step; the client can't, since browsers don't strip TypeScript types. [`bd39395`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/bd39395) scaffolds `tsconfig.client.json` (`NodeNext`, so source imports are written as the `.js` file the compiler will actually emit) to compile the client separately with `tsc`, emitting plain ES modules loaded directly via `<script type="module">` — no bundler. [`b890564`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/b890564) builds the client itself on that: a handful of draw calls per tick and no DOM tree to diff don't justify React or a game engine at this scale.

## Where this stands

The slice `CLAUDE.md` and `README.md` committed to is built and verified: [`eef072d...b890564`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/compare/eef072d...b890564) takes the repo from a planning document to a server-authoritative game loop (centroid steering, collisions, the real `multiplier(n)` formula), a `node:sqlite`-backed persistence layer, a WebSocket handshake and game protocol, and a vanilla canvas client — with every step checked against the spec tests written for it before the code existed, and a manual two-client run confirming the full path end to end: waiting at one player, running at two, score rising correctly as food is eaten, and a wall collision finalizing a run that `GET /api/summary?token=...` then hands back correctly to that specific player. Still ahead: shipping the repo public and deploying it.
