# Collective Snake

Collective Snake is a cooperative Snake variant: no single player steers the snake. Every active player controls a cursor, and the snake steers smoothly toward the centroid of every active player's cursor, each contributing exactly `1/n`. Nobody just watches their own input move the snake - it only moves where the group, together, is currently pointing.

## Try it

Open this page, pick a name and a colour, and send the link to someone else - or, to try it alone, open it again in a private/incognito window. One session sees a waiting state; once a second joins, both cursors steer the same snake. Reopening it as an ordinary tab in the same browser won't add a second player - it offers to take over the one you already have open. Past two people, everyone else joins mid-run with a brief introduction rather than snapping the snake toward them.

## What's live right now

- server-authoritative centroid steering; under two players, the game waits - no single-player mode
- real scoring: group-size multiplier, pickups that grow or speed the snake (never both), multiple food items
- results, including your own best score, persist across restarts and redeploys
- moves reach every session in well under a second, no reload
- one identity, one cursor: reopening the game offers a takeover, not a second player
- a name plus one of 16 accessible colours, names always shown too
- a brief introduction joining mid-run; a grace period on a dropped connection
- up to 12 active players, then a FIFO queue
- `G` for a ghost trail, `C` for the shared centroid, both off by default and in Help
- an optional per-name password; a "Stats" dialog with records and replay
- every identity, queue, and scoring action is logged server-side, never trusted from the browser

## What good means for this app

Good doesn't require scale: this is a small game for a few people in one sitting, judged on whether a stranger opening the link reads the whole game state at a glance - legibility, in game-design terms.

The design starts from one line: a good multiplayer game should make cooperation necessary, not merely visible - interreliance, in HCI terms. Most small multiplayer apps settle for the weaker version: a shared board, each person steering their own piece. Here nobody steers the snake directly - every cursor pulls toward the centroid of all active cursors, each contributing exactly `1/n` - so a lone cursor has nothing to average against and simply can't move the snake. Not a disabled feature; a consequence of the mechanic.

That argues against the obvious alternative of just rewarding bigger groups and stopping there. The real risk runs the other way: Ringelmann's rope-pulling experiments found individual effort dropping as groups grew - social loafing, coasting once contribution is hard to tell apart from the group's. The fix is keeping contribution identifiable, so the scoring multiplier, `1 + ((n-2)/10)²`, is increasing-returns, and every cursor keeps a visible name and colour. Scoring is computed server-side, so it can't be faked.

Identity is a pseudonym with an optional password, not an account - data minimisation, collecting only what the purpose requires, not the friction of email and verification.

Timing is the other deliberate pull: Nielsen's response-time thresholds put one second as where an action stops feeling direct, so moves reaching every session well under that is the boundary past which a shared snake would stop feeling shared.

Enforced, not claimed: the scoring formula, the two-player minimum, colour/name uniqueness, and persistence, all exercised by the test suite. Judged, not checked: whether the group's movement feels like cooperation, and whether it explains itself unaided - read off the deployed app, not a test. A handful of tests assume exclusive access to the server, so they can show a false failure against the live site if someone else happens to be connected at that moment - not a defect in the app itself.

**Sources:** legibility/no-filler, [Nealen, Saltsman & Boxerman](http://www.nealen.net/papers/tmgd.pdf) (FDG, 2011); interreliance, [Truesdell & Magerko](https://doi.org/10.1145/3582437.3582473) (FDG, 2023); the multiplier, the [Ringelmann effect](https://en.wikipedia.org/wiki/Ringelmann_effect) and social-loafing literature; pseudonym-over-account, the UK ICO's [data minimisation principle](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/); the one-second target, [Nielsen's response-time thresholds](https://www.nngroup.com/articles/response-times-3-important-limits/).
