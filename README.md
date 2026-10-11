# Collective Snake

Collective Snake is a cooperative Snake variant: no single player steers the snake. Every active player controls a cursor, and the snake steers smoothly toward the centroid of every active player's cursor, each contributing exactly `1/n`. Nobody just watches their own input move the snake — it only moves where the group, together, is currently pointing.

## What's live right now

- the snake is steered by a real, server-authoritative centroid of however many sessions are currently active
- the game needs at least two active players to run at all — there is no single-player version, by design: a lone cursor has nothing to average against, so the game simply waits
- scoring is real: a group-size multiplier applies to every food item collected, rewarding bigger groups rather than tapering off as they grow
- a run's result is saved, and persists across restarts and redeploys, so coming back later still shows you something
- every move anyone makes reaches everyone else's screen in well under a second, with no reload
- an identity only ever drives one cursor at a time: opening the game again while it's already open elsewhere offers to take over, rather than quietly becoming a second player
- you pick a name and one of 16 accessible colours before you join, so cursors are easy to tell apart at a glance and colour is never the only way to recognise someone
- joining a game already in progress gives you a brief, visible introduction before your cursor starts influencing anything; losing your connection gives the group a grace period, with a flashing cursor, before you're actually counted as gone
- up to 12 people can play in one run; beyond that you spectate, and can ask to join a FIFO queue that offers you the next open slot with a few seconds to claim it
- a faint ghost trail of the current record run plays continuously while you play, toggled with `G`
- a public stats page lists every record run and total play across the whole site, and lets you replay any record run on its own
- a name can carry an optional password, set once when you first claim it: with one set, reclaiming that name on a different device needs it; with none, the name is reclaimable by anyone who knows it, no password required at all

## Try it

Open this page, pick a name and a colour, then open it again in a different browser, a private/incognito window, or send the link to someone else. With only one session connected you'll see a waiting state; once a second session joins, both cursors start steering the same snake. Opening it again as an ordinary new tab in the same browser won't add a second player — it'll ask whether you want to take over the one you already have open. With more than two people, everyone past the first two joins mid-run with a brief introduction rather than snapping the snake toward them instantly.

## What good means for this app

Good doesn't require scale here. This is a small game for a handful of people in one sitting, not a packed arena, and it's judged on that basis. A good version of this app lets a group feel their own movement blend with everyone else's, without needing any instructions beyond what's on the screen. The scoring behind that moment is real, not decorative: it's calculated by the server, and it actually responds to how many people are playing, rewarding bigger groups rather than just allowing them. And when someone comes back later, after a refresh, a restart, or a redeploy, they should still find their own last result waiting for them, not a blank slate.

It isn't yet trying to look especially polished, or to give a return visit anything beyond the shared score. Those matter, and they're coming, but they're not what this version is judged on.

## What comes next

- a personal participation score, separate from the shared score, so a return visit has something of your own to beat
