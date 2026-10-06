# Process

The planning-phase account — how `planning.md` arrived at its current
design, across three commits — is in `INPROGRESS.md` for now. It gets
folded into this file once this week's implementation is complete, rather
than copied in before there's anything real to combine it with.

## Persistence: `node:sqlite` over a native driver

[`4398aa1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/4398aa1)
adds the DB layer on Node's built-in `node:sqlite` module (`DatabaseSync`)
rather than `better-sqlite3`. The deciding factor was the Docker build: Fly's
one machine has no separate database server, so everything durable lives in
SQLite on the one mounted volume, and `node:sqlite` needs no native
compilation step to get there — `better-sqlite3` would need node-gyp in the
image for one dependency. The trade-off, recorded honestly rather than
glossed over: Node's own docs still mark it "Stability: 1.2 — release
candidate," not fully stable. That's mitigated by sticking to its narrowest,
longest-settled surface (`exec`, `prepare().run/get/all`) and nothing more
exotic.

## Schema: the smallest thing that can prove persistence

Three tables: `players`, `runs`, `run_players`. This is a strict subset of
the ~20-field persistence model `planning.md` section 20 describes — no food
event logs, no replay sampling, no participation records yet — and nothing
in it needs to be migrated away later, only added to.

One addition beyond what was originally scoped: a `token` column on
`players`, generated when a pseudonym is claimed and meant to be kept
client-side (`localStorage`), because `GET /api/summary` needs a way to find
*this* visitor's last run specifically, not just a global number — that's
the difference between "a trace is still there" and "a counter went up
somewhere."

## Server: plain `node:http` + `ws`, no build step

[`7b1bb70`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/7b1bb70)
runs the server as `node src/server/index.ts` directly, rather than through
a framework or a compiled output. Node 24.21 (pinned in `mise.toml`) has had
type stripping stable since 24.12, and `tsconfig.json`'s own
`allowImportingTsExtensions` comment was already pointing at exactly this.
This week's server is a handful of routes plus one WebSocket upgrade
([`1a421e8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/1a421e8)) —
Express or Fastify would add a dependency tree and a routing abstraction the
app doesn't need yet, for no benefit at this size. `ws` is the plain,
widely-used WebSocket implementation; its optional native speed-up packages
are allowed to fail silently on install, so it doesn't reopen the
native-build problem the `node:sqlite` choice was specifically avoiding.

Real-time transport is a WebSocket, not polling or server-sent events,
because the thing actually being proven this week — two sessions' cursor
input converging into one steered snake
([`1b232b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/1b232b0)) —
needs a bidirectional, low-latency channel; SSE has no client-to-server leg,
and polling at the ~15Hz the loop ticks would be both laggier and wasteful.

## Client: a real build step, vanilla canvas

The server can skip a build step; the client can't, since browsers don't
strip TypeScript types.
[`bd39395`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-brendanmeyer/commit/bd39395)
scaffolds `tsconfig.client.json` (`NodeNext`, so source imports are written
as the `.js` file the compiler will actually emit) to compile the client
separately with `tsc`, emitting plain ES modules loaded directly via
`<script type="module">` — no bundler. The client itself (input capture,
canvas rendering) is a later commit; the decision to stay framework-free
holds regardless — a handful of draw calls per tick and no DOM tree to diff
don't justify React or a game engine at this scale.
