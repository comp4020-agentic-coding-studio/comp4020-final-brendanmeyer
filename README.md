# Collective Snake

Collective Snake is a cooperative Snake variant: no single player steers the snake. Every active player controls a cursor, and the snake steers smoothly toward the centroid of every active player's cursor, each contributing exactly `1/n`. Nobody just watches their own input move the snake — it only moves where the group, together, is currently pointing.

## What's live right now

- the snake is steered by a real, server-authoritative centroid of however many sessions are currently connected
- the game needs at least two active players to run at all — there is no single-player version, by design: a lone cursor has nothing to average against, so the game simply waits
- scoring is real: a group-size multiplier applies to every food item collected, rewarding bigger groups rather than tapering off as they grow
- a run's result is saved, and persists across restarts and redeploys, so coming back later still shows you something

## Try it

Open this page, then open it again in a second browser window (or send the link to someone else). With only one session connected you'll see a waiting state; once a second session joins, both cursors start steering the same snake.

## What good means for this app

Good doesn't require scale here. This is a small game for a handful of people in one sitting, not a packed arena, and it's judged on that basis. A good version of this app lets two people feel their own movement blend with someone else's, without needing any instructions beyond what's on the screen. The scoring behind that moment is real, not decorative: it's calculated by the server, and it actually responds to how many people are playing, rewarding bigger groups rather than just allowing them. And when someone comes back later, after a refresh, a restart, or a redeploy, they should still find their own last result waiting for them, not a blank slate.

It isn't yet trying to be good at supporting more than a couple of players gracefully, remembering who someone is across different devices, looking polished, or recovering cleanly from a dropped connection. Those matter, and they're coming, but they're not what this version is judged on.

## What comes next

- persistent accounts secured with a password, so a name can be reclaimed on a different device, not just remembered for one pseudonym
- an accessible colour assigned to each player, so cursors are easier to tell apart at a glance
- room for more than two players at once, with a queue for whoever's waiting their turn
- softer join and disconnect transitions: a brief introduction window for new players, and a grace period before someone is counted as gone
- a ghost trail showing the current record run, visible while you play
- a personal participation score, separate from the shared score, so a return visit has something of your own to beat
- a public record board and site-wide stats, once there's enough play happening to make them worth showing
