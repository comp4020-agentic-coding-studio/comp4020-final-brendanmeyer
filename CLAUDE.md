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

## Process rules for this build

- **Tests first.** Before the code a `spec/*.test.ts` file exercises gets written, the test itself is written, run, confirmed to fail, and committed. A feature isn't done until that test — and everything earlier — is green again.
- **Commit at each meaningful step**, not in one dump at the end. `INPROGRESS.md`'s narrative grows after each commit, via the process-recorder skill, citing commits by hash, so the account is checkable against real history, not a summary written after the fact.
- **Build the smallest schema that carries the core interaction.** Don't reach ahead into a deferred invariant just because it would be easy to add while already in the relevant file — scope creep here is still scope creep, even when it's "good" scope.
- `pnpm check` (typecheck + test) passes locally before a step is described as shipping working behaviour.
