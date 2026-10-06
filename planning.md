# Collective Snake

## Design Principle

**A good multiplayer game should make the other players’ cooperation necessary, not merely visible.**

No individual player directly controls the Snake. Instead, every active player controls a virtual cursor, and the Snake moves toward the centroid of all active players’ positions.

Every active player has equal influence:

`player influence = 1 / number of active players`

The game therefore cannot meaningfully be played alone.

---

## 1. Player Identity

Every player has:

- a persistent database player ID;
- a pseudonym;
- an optional password;
- a browser session ID;
- a session participation multiplier;
- a selected colour while active.

### Name Entry

When loading the site, the player is presented with a generated pseudonym but may enter their own instead.

User-entered pseudonyms:

- may contain alphanumeric characters only;
- have a maximum length of 22 characters;
- are checked case-insensitively for uniqueness;
- are passed through a basic offensive-word filter;
- cannot duplicate an existing account unless the correct password is supplied.

An empty name causes the server to generate a random valid pseudonym.

### Passwords

Passwords are optional.

If a new pseudonym is created with a password, the password must be supplied on later logins to retrieve that player.

If a new pseudonym is created with a blank password, that identity remains passwordless.

There is no password-reset system.

Passwords must never be stored as plaintext. The database stores a password hash.

The database should use an internal unique `player_id`; the pseudonym/password combination is the authentication mechanism used to retrieve that player.

### Browser Session

Once authenticated, the player's identity is stored for that browser session.

Refreshing the page preserves:

- player identity;
- browser session;
- session participation multiplier;
- preferred colour where possible.

Explicitly starting a new login/session creates a new browser session and therefore a new participation multiplier.

---

## 2. Player Colours

There are **16 predefined accessible player colours**.

Colours should be selected to remain distinguishable under common colour-vision deficiencies.

Player identity is never communicated by colour alone. Cursors also display the player's pseudonym.

On the name-entry screen, a player may select an available colour.

A colour cannot be simultaneously used by two active players.

Because the game supports at most 12 active players, at least four colours remain unused during normal active play.

A player's colour preference persists for their browser session.

When a player is disconnected, their active colour reservation is released and another player may select it.

If the original player later reconnects after having been fully disconnected and their previous colour has been taken, they must use another available colour.

Spectators do not reserve active-player colours while waiting in the lobby.

---

## 3. Minimum Player Count

A game requires at least **2 active players**.

With fewer than 2 active players, the game enters a paused/waiting state.

The complete existing game state remains intact while paused, including:

- Snake position;
- Snake direction;
- Snake length;
- food positions;
- raw score;
- collective score;
- run history;
- elapsed run state;
- progression state.

The interface displays the same waiting message used when only one player is present.

When enough players become available again, the existing run resumes rather than restarting.

---

## 4. Joining an Active Game

Players may join a game already in progress.

When a new player enters an active game:

1. their cursor flashes for 2 seconds (increasing in speed);
2. their pseudonym and arrival are shown;
3. they receive a **2-second introduction period**;
4. they do not affect the centroid during those 2 seconds;
5. they do not count toward the multiplayer score multiplier during those 2 seconds;
6. after the introduction completes, they become active.

The player's arrival therefore cannot instantly change the Snake's direction.

---

## 5. Leaving, Disconnecting and Reconnecting

### Disconnect Timeout

The disconnect timeout is:

`3 seconds`

If the server stops receiving valid connection activity from a player for 3 seconds, that player is considered disconnected.

Before that timeout expires, a reconnecting client remains the same active participant.

### Full Disconnect

Once a player is considered disconnected:

1. they immediately stop contributing to the centroid;
2. they immediately stop counting toward the multiplayer multiplier;
3. their cursor flashes for 2 seconds (decreasing in speed);
4. their cursor is then removed;
5. their active colour becomes available again.

The 2-second flashing period is visual only.

### If Enough Players Remain

If at least 2 active players remain, the game continues.

### If Fewer Than 2 Players Remain

The game immediately pauses.

Its state is preserved.

A new eligible player can later join and resume that same run.

### Returning After Full Disconnect

If a player reconnects after already being considered disconnected:

- they retain their database player ID;
- they retain their pseudonym;
- they retain historical scores/statistics;
- they enter the lobby/queue like any other joining player;
- they do not automatically reclaim their former active slot;
- their previous colour is reused only if still available.

---

## 6. Active Player Capacity and Lobby

A game supports a maximum of:

`12 active players`

Visitors beyond this limit enter a lobby/spectator state.

Spectators can:

- watch the game live;
- see all active player cursors;
- see player names;
- see the centroid if their local display mode enables it;
- see the Snake;
- see current raw score;
- see collective score;
- see the current multiplier;
- see the active player count;
- see the ghost trail;
- view run history;
- view leaderboard data;
- view global statistics;
- replay stored historical record runs.

Spectators do not:

- influence the centroid;
- count toward the multiplier;
- receive active participation credit;
- reserve active-player colours.

---

## 7. Lobby Queue

When the active game is full, spectators join a **FIFO queue**.

The spectator who has waited longest receives the next available active slot.

When a slot becomes available:

1. the first eligible spectator receives a join offer;
2. a **5-second countdown** begins;
3. the spectator must accept/join within those 5 seconds;
4. if accepted, they proceed into the game;
5. if the timer expires, the offer passes to the next person in the FIFO queue.

A declined or expired offer does not permanently remove the spectator from the site, but they move behind currently waiting eligible spectators if they request to join again.

### Joining a Paused Game

If the game currently has fewer than 2 active players, the promoted/joining player receives a **5-second resume countdown**.

During this countdown:

- the game remains paused;
- the joining player's cursor may be displayed;
- they do not yet influence the centroid;
- they do not yet affect the multiplier.

When the countdown reaches zero, the player becomes active and the existing game resumes.

This 5-second resume countdown replaces the normal 2-second introduction for a player who is specifically restoring a paused game.

---

## 8. Communication

There is **no text chat**.

Players coordinate through:

- their cursor positions;
- observing other player cursors;
- observing the shared centroid where enabled;
- observing the resulting Snake movement.

This limitation is intentional.

Communication through shared movement is part of the game's central interaction.

---

## 9. Input

Every player controls the same conceptual **virtual cursor** regardless of device.

### Mouse

Mouse movement positions the virtual cursor.

### Touch

Touch users manipulate a draggable virtual cursor.

When the user lifts their finger, the virtual cursor remains at its most recent position.

### Keyboard

Keyboard users move the same virtual cursor using:

- WASD; or
- arrow keys.

Input devices therefore produce the same normalized cursor state.

---

## 10. Coordinate System and Centroid

Player positions are normalized rather than transmitted as raw pixels.

For example:

- `x = 0.0` = left edge;
- `x = 1.0` = right edge;
- `y = 0.0` = top edge;
- `y = 1.0` = bottom edge.

Therefore `(0.5, 0.5)` represents the centre on every viewport.

The group target is:

`centroid.x = sum(activePlayer.x) / activePlayerCount`

`centroid.y = sum(activePlayer.y) / activePlayerCount`

The Snake smoothly steers toward this target.

It does not teleport directly to the centroid.

Every active participant always contributes exactly:

`1 / n`

of the target position.

---

## 11. Centroid Visibility / Easy and Hard Mode

Centroid visibility is a **local display setting**, not a change to the shared game simulation.

### Easy Mode

The centroid is visibly displayed.

This makes it easier to understand where the group is collectively directing the Snake.

### Hard Mode

The centroid is hidden.

Players must infer the collective target from:

- other cursors;
- their own position;
- the Snake's movement.

Each player or spectator may toggle this independently.

Suggested hotkey:

`C = toggle centroid visibility`

Changing this setting has no effect on:

- Snake behaviour;
- scoring;
- other players;
- server state.

---

## 12. Snake Movement

Movement is smooth rather than grid-step animation.

The Snake cannot perform an instantaneous 180-degree reversal into itself.

The server constrains steering so the Snake must turn progressively toward the centroid.

Classic Snake behaviour is retained:

- the Snake dies on wall collision;
- the Snake dies on self-collision;
- a growth or speed increase applies when food is eaten.

### Progression

The server applies one randomly selected progression bonus:

- increase movement speed slightly; or
- add Snake growth.

The random progression choice is server-authoritative.

A default implementation may use an approximately equal chance between the two effects.

Speed increases should be capped so that the game remains controllable rather than accelerating indefinitely.

The exact tuning values may be adjusted through playtesting without changing the core rules.

---

## 13. Food Spawning

Multiple food items may exist simultaneously.

The maximum number of food items is:

`number of active players`

However, spawning intentionally prefers **fewer food items**.

For possible food counts `k = 1 ... n`, lower values receive greater probability than higher values.

A suitable weighting is:

`weight(k) = 1 / 2^(k - 1)`

This means:

- 1 fruit is strongly preferred;
- 2 fruits are less common;
- 3 fruits are less common again;
- reaching the maximum player-count quantity is possible but rare.

The server performs all spawning.

### Valid Spawn Locations

Food must:

- be clearly visible;
- render above ghost trails;
- not spawn inside the Snake;
- not spawn inside walls;
- not spawn in inaccessible enclosed locations;
- be reachable from the current playable area.

Spawn validation should reject invalid candidate locations before placing food.

Ghost trails are visual history only and never block food.

---

## 14. Collective Scoring

Every run tracks:

- **Raw Score**
- **Collective Score**

### Raw Score

The raw score reflects the underlying Snake performance before multiplayer bonuses.

Each food item has a fixed base value.

Example:

`baseFoodPoints = 100`

### Collective Score

The collective score applies the group-size multiplier independently to every food collection.

For `n` active players:

`multiplier(n) = 1 + ((n - 2) / 10)^2`

for:

`2 <= n <= 12`

The resulting values are:

| Active Players | Individual Influence | Multiplier |
|---|---:|---:|
| 2 | 50.0% | ×1.00 |
| 3 | 33.3% | ×1.01 |
| 4 | 25.0% | ×1.04 |
| 5 | 20.0% | ×1.09 |
| 6 | 16.7% | ×1.16 |
| 7 | 14.3% | ×1.25 |
| 8 | 12.5% | ×1.36 |
| 9 | 11.1% | ×1.49 |
| 10 | 10.0% | ×1.64 |
| 11 | 9.1% | ×1.81 |
| 12 | 8.3% | ×2.00 |

For every collected food item:

`foodEventScore = baseFoodPoints × multiplier(activePlayers)`

The result is rounded to the nearest whole point.

The final score is:

`collectiveScore = sum(all foodEventScores)`

The raw score is:

`rawScore = sum(all baseFoodPoints)`

Previously earned points can never be retrospectively changed by later joins or departures.

---

## 15. Deterministic Same-Tick Scoring

All score-relevant events are resolved by the authoritative server in a fixed order.

For every simulation tick:

1. process confirmed connection/disconnection state changes;
2. determine the active-player set;
3. process current valid player input;
4. calculate the centroid;
5. advance the Snake;
6. resolve wall/self collisions;
7. resolve food collisions;
8. calculate each food event using the active-player count established at the beginning of that tick;
9. update score;
10. spawn replacement/new food as required;
11. broadcast the resulting state.

Therefore, if a player joins or disconnects during the same server tick that food is collected, the server's processed active-player state for that tick deterministically determines the multiplier.

---

## 16. Who Counts as an Active Player

A participant counts toward the centroid and multiplier only while actively controlling the game.

Therefore:

- active controller → **counts**
- spectator → **does not count**
- queued spectator → **does not count**
- 2-second joining introduction → **does not count**
- 5-second paused-game resume countdown → **does not count**
- disconnected/flashing player → **does not count**
- stale player beyond the 3-second timeout → **does not count**

The core invariant is:

**If a player influences the centroid, they count toward the multiplier. If they do not influence the centroid, they do not count toward the multiplier.**

---

## 17. Personal Participation Score

Each active participant receives a personal participation score.

This score is intentionally **not directly comparable between players**.

It exists to let a player track their own performance and personal bests without turning the game into an individual competition.

### Base Participation

A simple base participation value is calculated from server-observed involvement.

For example:

`participationBase = activeSeconds + (25 × foodCollectedWhileActive) + completionBonus`

where:

`completionBonus = 50`

if the player was active when the run ended.

The exact component weights are server-controlled and may be tuned.

### Random Session Multiplier

At the beginning of each new browser session, the server generates a random personal multiplier.

For example:

`sessionParticipationMultiplier ∈ [0.75, 1.25]`

The multiplier:

- is generated server-side;
- is associated with the browser session;
- persists across page refreshes;
- persists across multiple runs during that browser session;
- is not regenerated on temporary reconnect;
- is discarded when that browser session ends;
- is newly generated the next time the player starts a new login/session.

The displayed participation score is:

`personalParticipationScore = round(participationBase × sessionParticipationMultiplier)`

The random multiplier is deliberately not exposed as a competitive mechanic.

Because two people may have different hidden session multipliers, their participation scores are not meaningful as direct comparisons.

A returning player can still compare their current score with **their own stored personal best**, while understanding that each login/session represents a slightly different scoring context.

There is no global personal-participation leaderboard.

Participation scores never affect:

- collective score;
- centroid influence;
- multiplayer multiplier;
- queue priority;
- colour priority.

---

## 18. Game Over and Restart

The Snake dies when it:

- collides with a wall; or
- collides with itself.

After game over:

1. the run is finalized;
2. raw score is saved;
3. collective score is saved;
4. player-count history is saved;
5. participation data is saved;
6. ghost replay data is saved where required;
7. global statistics are updated;
8. leaderboard position is determined;
9. the result screen is shown;
10. a **5-second restart countdown** begins.

After the countdown:

- if at least 2 active players remain, a new run starts;
- if fewer than 2 remain, the game waits until the minimum is restored.

---

## 19. Record Ties

Leaderboard ordering is deterministic.

Runs are sorted primarily by:

`collective score descending`

If multiple runs have exactly the same collective score:

- the run that achieved that score first keeps the higher position;
- later tied runs are displayed below it.

Conceptually:

`ORDER BY collective_score DESC, achieved_at ASC`

A later tied score therefore never displaces the original record-holder from the top position.

---

## 20. Persistence

The database stores the complete meaningful history required to reconstruct statistics and historical runs.

Persistent data includes:

- player accounts;
- player pseudonyms;
- password hashes where applicable;
- run history;
- raw score;
- collective score;
- food events;
- player-count changes;
- active-player durations;
- peak player count;
- average active player count;
- participant IDs/names;
- personal participation results;
- personal bests;
- cumulative global statistics;
- record history;
- Snake path replay data;
- historical player-cursor replay data.

Live cursor positions do not need permanent storage during ordinary games unless they are being stored as part of replay data.

---

## 21. Ghost Trails and Historical Replays

The current global-record run is displayed by default as a faded **ghost trail**.

The ghost includes:

- historical Snake path;
- faded historical player cursor positions.

The ghost is visual only.

It cannot:

- cause collisions;
- block food;
- influence the centroid;
- affect scoring.

### Ghost Visibility

Ghost display is enabled by default.

Suggested hotkey:

`G = toggle ghost visibility`

The setting is local to each viewer.

### Record History

Old record runs are never discarded merely because a new record is achieved.

All historical record runs remain available in history.

Selecting a stored record allows the user to replay:

- Snake movement;
- historical player cursor movement;
- score progression;
- player-count changes.

Replay data should be sampled at a reasonable server-defined rate rather than necessarily storing every render frame.

For example:

`10 samples per second`

This retains useful replay fidelity without unnecessarily large storage.

---

## 22. Global Statistics

The database may retain detailed game/event information for later analysis.

The main public global-statistics interface displays:

- total runs;
- total food collected;
- total unique players;
- total play time;
- largest active group;
- all-time record collective score.

Additional historical information can be derived from stored run/event data without needing to appear permanently in the primary interface.

---

## 23. Server Authority

The server is authoritative for:

- player/session state;
- authentication;
- active-player membership;
- disconnect timeout;
- lobby queue;
- centroid calculation;
- Snake movement;
- collision detection;
- food spawning;
- random progression events;
- score calculation;
- participation calculation;
- participation multiplier generation;
- record determination;
- game state;
- persistence.

Clients send input intentions and render authoritative state.

Clients cannot declare:

- their own score;
- player count;
- multiplier;
- food collection;
- collision outcome;
- queue position.

---

## Core Invariants

The implementation must preserve the following:

1. A game cannot run with fewer than 2 active players.
2. A game cannot contain more than 12 active players.
3. Every active player contributes exactly `1/n` to the centroid.
4. Spectators never influence gameplay.
5. Spectators never influence scoring.
6. Joining players do not affect gameplay during their introduction/countdown.
7. Disconnect timeout is 3 seconds.
8. Fully disconnected players immediately stop influencing the centroid and multiplier.
9. Their cursor may remain flashing for 2 seconds as visual feedback only.
10. Falling below 2 active players pauses rather than destroys a run.
11. A paused run resumes from the same state.
12. Queue order is FIFO.
13. A queue promotion has a 5-second claim window.
14. Game-over restart countdown is 5 seconds.
15. Mouse, touch and keyboard manipulate the same virtual-cursor abstraction.
16. Player coordinates are normalized across viewport sizes.
17. The Snake moves smoothly toward the centroid.
18. Instant 180-degree reversal is impossible.
19. Food cannot spawn in inaccessible or occupied locations.
20. Multiple food items may exist, up to the number of active players.
21. Lower food counts are more likely than higher food counts.
22. Multiplayer scoring is calculated separately for every food event.
23. Previously earned points cannot change after later joins or departures.
24. Same-tick event ordering is deterministic and server-controlled.
25. A 2-player food event receives ×1.00.
26. A 12-player food event receives ×2.00.
27. Participation scoring never changes collective control or collective score.
28. The participation multiplier persists for one browser session only.
29. Refreshing preserves the current browser session and identity.
30. A fully disconnected returning player retains their account identity but re-enters through the queue.
31. Player names are alphanumeric, filtered, and at most 22 characters.
32. Passwords are never stored in plaintext.
33. Active colours are unique among active players.
34. Colour alone is never the only player-identity signal.
35. Centroid visibility can be toggled locally.
36. Ghost visibility can be toggled locally.
37. Historical record replays remain available after a new record replaces them.
38. Equal record scores preserve chronological priority.
39. Completed runs and records survive restarts and redeployments.
40. There is no single-player fallback or bot replacement for missing humans.