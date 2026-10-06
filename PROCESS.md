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
