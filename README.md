# Collective Snake

Collective Snake is a cooperative Snake variant: no single player steers the snake. Every active player controls a cursor, and the snake steers smoothly toward the centroid of every active player's cursor, each contributing equally. Nobody just watches their own input move the snake - it only moves where the group, together, is currently pointing.

## Try it

Pick a name and a colour, then send the link to someone else - or open it in a private/incognito window to try it alone. One session waits; a second joining steers the same snake. A second tab in the same browser offers a takeover instead of adding a player. Past two, everyone else joins mid-run with a brief introduction, not an instant snap.

## What's live right now

- server-authoritative centroid steering; under two players, the game waits - no single-player mode
- real scoring: group-size multiplier, pickups that grow or speed the snake (never both), multiple food items
- results, including your own best score, persist across restarts and redeploys
- moves reach every session in well under a second, no reload
- one identity, one cursor, a takeover offer on a second connection; a grace period on disconnect
- a name plus one of 16 accessible colours, names always shown too; joining mid-run gets a brief introduction
- up to 12 active players, then a FIFO queue
- `G` for a ghost trail, `C` for the shared centroid, both off by default and in Help
- an optional per-name password; a "Stats" dialog with records and replay
- every identity, queue, and scoring action is logged server-side, never trusted from the browser

## What good means for this app

Good doesn't require scale: this is a small game for a few people in one sitting, judged on whether a stranger opening the link reads the whole game state at a glance - legibility, in game-design terms.

The design starts from one line: a good multiplayer game should make cooperation necessary, not merely visible - interreliance, in HCI terms. Most small multiplayer apps settle for the weaker version: a shared board, each person steering their own piece. Here nobody steers the snake directly - every cursor pulls toward the centroid of all active cursors, each contributing exactly `1/n` - so a lone cursor has nothing to average against and simply can't move the snake. Not a disabled feature; a consequence of the mechanic.

That argues against the obvious alternative: just reward bigger groups and stop there. The real risk runs the other way - Ringelmann's rope-pulling experiments found individual effort dropping as groups grew, social loafing, coasting once contribution is hard to tell apart from the group's. The fix is keeping contribution identifiable, so the multiplier, `1 + ((n-2)/10)²`, is increasing-returns, and every cursor keeps a visible name and colour; scoring itself is server-side, so it can't be faked.

Identity is a pseudonym with an optional password, not an account - data minimisation, collecting only what the purpose requires, not the friction of email and verification.

Timing is the other deliberate pull: Nielsen's response-time thresholds put one second as where an action stops feeling direct, so moves reaching every session well under that is the boundary past which a shared snake would stop feeling shared.

Enforced, not claimed: the scoring formula, the two-player minimum, colour/name uniqueness, and persistence, all exercised by the test suite. Judged, not checked: whether the group's movement feels like cooperation, and whether it explains itself unaided - read off the deployed app, not a test. (A few tests assume exclusive server access, so they can false-fail live if someone else is connected - not a defect.)

Deliberately not built: an offensive-word filter (planned, audited, never implemented, dropped rather than retrofitted) and password recovery (more account system than a pseudonym-for-an-evening needs). There's also no text chat - coordination runs through cursor movement alone, the same restriction *Journey* uses to make two strangers cooperate wordlessly - and no moderation or kick system, for the reasons `decisions/0002` already gives.

**Sources:** legibility/no-filler, [Nealen, Saltsman & Boxerman](http://www.nealen.net/papers/tmgd.pdf) (FDG, 2011); interreliance, [Truesdell & Magerko](https://doi.org/10.1145/3582437.3582473) (FDG, 2023); the multiplier, the [Ringelmann effect](https://en.wikipedia.org/wiki/Ringelmann_effect) and social-loafing literature; pseudonym-over-account, the UK ICO's [data minimisation principle](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/); the one-second target, [Nielsen's response-time thresholds](https://www.nngroup.com/articles/response-times-3-important-limits/); no-chat-as-design, [Arjoranta & Siitonen on *Journey*'s wordless cooperation](http://gamestudies.org/1802/articles/arjoranta_siitonen) (*Game Studies*, 2018).
