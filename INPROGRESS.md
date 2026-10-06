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

## Where this stands

Nothing beyond `planning.md` has been built yet - there's no server, no harness, no `spec/` checks beyond the two the template ships with, and no agentic workflow to describe. The placeholder app is what's currently deployed. This section will be replaced once implementation starts; until then this document covers the design phase only, honestly, rather than describing a harness or workflow that doesn't exist yet.

## What I'd want in a reflection for this crit

The standing reflection questions (what was the breakthrough, what did this change about who I want to be as a developer) aren't answered here on purpose - at this point in the week there's a design, not yet a breakthrough in building it, and I'm not going to write that account for you. `reflections/crit-8.md` should wait until there's something true to put in
it.
