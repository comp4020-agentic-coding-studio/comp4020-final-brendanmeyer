# Your harness

`planning.md` carries the full design for Collective Snake: a cooperative Snake where no one player steers directly, every active player's cursor pulls the snake toward their shared centroid. This file states what "good" means for the app as it stands right now, and the process rules that keep the build honest.

## What good means for this app

1. `README.md` and the `spec/` tests stay aligned with what this file says, so all three are consistent with one another.
2. A stranger can open the deployed link and, whether that's by opening a second browser window themselves or by someone else joining, within a few seconds see two independent cursors visibly steer one shared snake toward their shared centroid. Nothing beyond what's on screen should need explaining.
3. There is no single-player fallback: a run needs at least two active players, and with fewer than two the game waits rather than running solo or with a bot standing in.
4. Scoring is real and server-authoritative: the exact `multiplier(n) = 1 + ((n - 2) / 10)^2` formula from `planning.md` §14, not a placeholder standing in for it. Each pickup also randomly grows the snake or speeds it up, never both, and the board can hold more than one food item at once, weighted toward showing fewer.
5. A visitor's own result persists and is shown back to *them* specifically — not just a global number — when they return, including across a restart or redeploy (the one Fly volume at `/data` is the only durable storage; nothing else survives).
6. Real-time holds on the deployed app, not just in local tests: a change one player makes reaches every other open session within about a second, with no reload.
7. Player identity across a connection change has two distinct cases, and both are handled deliberately rather than left to coincidence. If a token that's already live gets used again while the first connection is still open, the new connection is offered a takeover rather than silently doubling up or silently kicking the original. If the first connection actually goes away, a 3-second timeout starts a 2-second flashing-cursor grace period before the slot is released; a run that drops below 2 active players pauses with its state preserved rather than ending, and a reconnecting token re-enters through the lobby/queue rather than auto-resuming its old slot. See `decisions/0001`.
8. Player colours and their reservation rules hold: 16 accessible colours, one active player per colour at a time, released on disconnect, and colour is never the only way to tell two cursors apart — names are always shown too.
9. Joining a game already running gives a 2-second visible introduction before a cursor starts influencing anything; a reconnecting token restoring a paused run instead gets the 5-second resume countdown `planning.md` §7 describes.
10. Up to 12 active players are supported; beyond that a visitor spectates, with a FIFO queue offering the next open slot and a 5-second window to claim it.
11. A name can carry an optional password, set at claim time or added later from the game itself if it wasn't: with one set, reclaiming that name on a different device needs it; with none, the name is reclaimable by anyone who knows it. The entry screen only asks for a password when this browser doesn't already hold an identity; once connected, a "Change user" button is the deliberate way to leave the current identity and claim or retrieve a different one.
12. The shared centroid the snake is steering toward can be shown or hidden with a key (hidden by default), and a faint ghost trail of the current record run can be toggled on with another key — off by default during play, but shown automatically while waiting for a second player, since there's nothing else moving on that screen; a "Help" button lists both, and also offers them as tappable buttons for a phone, where there's no keyboard to press a letter on.
13. A "Stats" button opens global stats and every record run, with a replay, as a dialog laid over the game rather than a page of its own; closing it returns to the game if the visitor is still connected, or the entry screen if their connection was already gone.
14. What each person may see or change is checked on the server, never trusted from the browser, and that decision is written down in `decisions/0002`: no message the protocol accepts can even name another player, so every mutating action already resolves to the caller's own identity by construction.
15. Every identity, queue, role, and scoring transition is logged server-side, by who did it, in a way that survives a restart or redeploy — a persistent `events` table on the one Fly volume, and `console.log` lines a presenter can tail live with `flyctl logs -a <repo>`. While a game is actually being played, the server also logs every active player's current position on a timer, not just when something happens.
16. A chosen name is passed through a basic offensive-word filter before it's accepted, per `planning.md` §1 — an invalid or rejected name falls back the same way an already-taken or malformed one does, never left for the player to retype against a silent rejection.
17. A visitor's own high score is shown back to them specifically — their best collective score among every run they've taken part in, not the site-wide record — the same per-visitor trace point 5 already establishes, surfaced alongside their last run rather than as a separate feature.
18. Both checks the course template fixes (`/` answers 200; `/readme/` serves `README.md`'s headings in order) and every check this repo adds under `spec/` are green before a step is called finished.
19. Nothing beyond what this file lists is half-built. Whatever's listed as not doing below stays fully out — not started, not stubbed — rather than left half-working and ambiguous.

## What this app doesn't do, on purpose

- **Passwords are not a full account system.** An existing password can't be changed or recovered; the only two actions are setting one at claim time and adding one later to a name that had none.

## Process rules for this build

- **Tests first.** Before the code a `spec/*.test.ts` file exercises gets written, the test itself is written, run, confirmed to fail, and committed. A feature isn't done until that test — and everything earlier — is green again.
- **Commit at each meaningful step**, not in one dump at the end. `INPROGRESS.md`'s narrative grows after each commit, citing commits by hash, so the account is checkable against real history, not a summary written after the fact.
- **Build the smallest schema that carries the core interaction.** Don't reach ahead into a deferred invariant just because it would be easy to add while already in the relevant file — scope creep here is still scope creep, even when it's "good" scope.
- `pnpm check` (typecheck + test) passes locally before a step is described as shipping working behaviour.
