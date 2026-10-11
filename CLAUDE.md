# Your harness

`planning.md` carries the full design for Collective Snake: a cooperative Snake where no one player steers directly, every active player's cursor pulls the snake toward their shared centroid. Crit 8's bar is proof of life, not that whole design, so this file states what "good" means for *this week's slice* specifically, and the process rules that keep the build honest about the gap between the two.

## What good means for this build (crit 8 scope)

1. `README.md` and the `spec/` tests stay aligned with what this file says, so all three are consistent with one another.
2. A stranger can open the deployed link and, whether that's by opening a second browser window themselves or by someone else joining, within a few seconds see two independent cursors visibly steer one shared snake toward their shared centroid. Nothing beyond what's on screen should need explaining.
3. Scoring is real and server-authoritative: the exact `multiplier(n) = 1 + ((n - 2) / 10)^2` formula from `planning.md` §14, not a placeholder constant standing in for it.
4. A visitor's own result persists and is shown back to *them* specifically — not just a global number — when they return, including across a restart or redeploy (the one Fly volume at `/data` is the only durable storage; nothing else survives).
5. Both checks the course template fixes (`/` answers 200; `/readme/` serves `README.md`'s headings in order) and every check this repo adds under `spec/` are green before a step is called finished.
6. Nothing beyond this week's stated scope is half-built. Whatever `README.md` lists as deferred stays fully out — not started, not stubbed — rather than left half-working and ambiguous.
7. The design's one non-negotiable constraint holds even at this small scale: there is no single-player fallback. `planning.md`'s 2-active-player minimum is enforced from the first commit that has a game loop at all, never temporarily relaxed for convenience.

What's explicitly **not** good-this-week, and so isn't a defect to fix now: passwords/auth, the 16-colour palette, more-than-2-player lobby/queueing, disconnect-timeout flashing, ghost-trail replay, personal participation scoring, a global-stats dashboard, a profanity filter. `README.md` says why each of these can wait.

## What good means for this build (crit 9 scope)

1. Real-time holds on the deployed app, not just in local tests: a change one player makes reaches every other open session within about a second, with no reload. Crit 8's tick loop already broadcasts every tick; this week's bar is that it demonstrably holds live, on the deployed URL, between independent sessions.
2. One decision about how the app behaves when several people use it at once is made, documented in the repo (`decisions/`), and defensible out loud — including the alternative that was rejected.
3. The decision this build makes is about player identity across a connection change: what happens when a token that's already live gets used again, either because a second connection shows up while the first is still open, or because the first one actually went away and the token resumes later. `planning.md` §5 designs the fuller version of the second case (a 3-second timeout, a flashing cursor, re-entry through a queue); that queue and timeout are still out of scope this week per the item below, so the decision explicitly includes choosing not to build them yet, not just what to do about a live duplicate.
4. Everything crit 8 established keeps holding: the 2-player minimum, the real `multiplier(n)` scoring, and per-visitor persistence across restarts and redeploys.
5. `README.md` and `spec/` stay aligned with what this file says, same as crit 8.
6. The process bar from crit 8 continues: tests first, commits at each step, `PROCESS.md` and `INPROGRESS.md` grown as the work happens, and this week adds `reflections/crit-9.md`.

What's still explicitly **not** good-this-week, for the same reasons as crit 8: passwords/auth, the 16-colour palette, more-than-2-player lobby/queueing, disconnect-timeout flashing, ghost-trail replay, personal participation scoring, a global-stats dashboard, a profanity filter. The disconnect-timeout/queue design is now also named directly in point 3 above, rather than only implied by the deferred list.

## What good means for this build (crit 10 scope)

1. Player identity across a connection change gets the full `planning.md` §5 answer, not the placeholder: a 3-second disconnect timeout, a 2-second flashing cursor as visual-only feedback, a run that pauses (state preserved) rather than ends when fewer than 2 active players remain, and a reconnecting token re-entering through the lobby/queue rather than auto-resuming its old slot.
2. That re-entry needs the neighbours it depends on to actually exist: player colours and their reservation/release rules (§2), the 2-second join-introduction flash for joining a game already running (§4), the 12-active-player capacity cap and spectator mode (§6), and the FIFO join queue with its 5-second claim window and 5-second paused-game resume countdown (§7).
3. The record-run concept these depend on is made real: deterministic leaderboard tie-break ordering (§19 — collective score descending, chronological priority on a tie), a ghost trail of the current record run visible while playing (§21), historical record replays that survive a new record being set (§21), and a public global-statistics view (§22).
4. `decisions/0001-identity-across-connection-changes.md` is rewritten in place to carry the new Case 2 answer and why it superseded the earlier one, not left describing behaviour the code no longer has.
5. Everything crit 8/9 established keeps holding: the 2-player minimum, real `multiplier(n)` scoring, per-visitor persistence, and the Case 1 (duplicate-live-connection) takeover handshake.
6. `README.md` and `spec/` stay aligned with what this file says, same as crit 8/9. Each piece's "what comes next" bullet moves only once that piece actually ships, not all at once up front.
7. The process bar continues unchanged: tests first, commits at each meaningful step, `PROCESS.md`/`INPROGRESS.md` grown as the work happens, `pnpm check` green before a step is called shipping.

Still explicitly out of scope, for reasons unrelated to this week's build and unaffected by it: passwords/account auth and cross-device identity reclaim, personal participation scoring (separate from the shared score), and a profanity filter. The 16-colour palette and the lobby/queue/disconnect-timeout/ghost-trail/stats items this file previously listed as deferred (crit 8/9 sections above) are what this section now builds — those sections stay as the historical record of what was scoped for their own crits, not an active restriction anymore.

## Process rules for this build

- **Tests first.** Before the code a `spec/*.test.ts` file exercises gets written, the test itself is written, run, confirmed to fail, and committed. A feature isn't done until that test — and everything earlier — is green again.
- **Commit at each meaningful step**, not in one dump at the end. `INPROGRESS.md`'s narrative grows after each commit, via the process-recorder skill, citing commits by hash, so the account is checkable against real history, not a summary written after the fact.
- **Build the smallest schema that carries the core interaction.** Don't reach ahead into a deferred invariant just because it would be easy to add while already in the relevant file — scope creep here is still scope creep, even when it's "good" scope.
- `pnpm check` (typecheck + test) passes locally before a step is described as shipping working behaviour.
