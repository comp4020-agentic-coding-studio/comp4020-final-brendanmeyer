# Collective Snake

## Design Principle

**A good multiplayer game should make the other players’ cooperation necessary, not merely visible.**

No individual player directly controls the Snake. Instead, every active player controls a virtual cursor, and the Snake moves toward the centroid of all active players’ positions.

Every active player has equal influence:

`player influence = 1 / number of active players`

The game therefore cannot meaningfully be played alone.

---

## 1. Player Identity

Each player receives:

- a unique session ID;
- a generated pseudonym;
- a generated colour.

When entering the site, the player can replace the generated pseudonym with their own name before joining.

The session ID, rather than the displayed name, determines whether someone is a distinct player.

---

## 2. Minimum Player Count

A game requires at least **2 active players**.

With fewer than 2 active players, the game enters a paused/waiting state.

The existing game state remains intact while paused.

The interface displays a waiting message indicating that another player is required.

---

## 3. Joining an Active Game

Players may join a game that is already running.

When a new player enters:

1. their cursor appears;
2. their pseudonym/arrival is shown;
3. they receive a **2-second introduction period**;
4. after those 2 seconds, their cursor begins contributing to the group's centroid.

Their arrival must not instantly alter the Snake's movement before the introduction finishes.

A player does not count toward the active-player score multiplier during this introduction period.

---

## 4. Leaving an Active Game

If a player leaves while **2 or more players will remain**, their cursor does not disappear instantly.

Instead:

1. their cursor flashes for 2 seconds;
2. it stops contributing to the centroid as soon as they are considered disconnected;
3. it stops counting toward the multiplayer score multiplier;
4. after the 2-second visual departure animation, the cursor disappears.

If a departure reduces the game to **fewer than 2 players**, the game pauses.

The complete game state is preserved, including:

- Snake position;
- Snake length;
- current score;
- food position;
- run duration/state;
- other relevant simulation state.

When another player joins, the game resumes from the same state after the normal joining/countdown process.

---

## 5. Player Capacity and Lobby

A game supports a maximum of **12 active players**.

When 12 players are already active, additional visitors enter a **lobby/spectator state**.

Lobby users can:

- watch the current game live;
- view previous run statistics;
- view collective records;
- view persistent global statistics.

Lobby users do not:

- affect the centroid;
- count toward the active-player multiplier;
- receive active-player participation credit.

When a player slot becomes available, lobby users may enter the active game.

---

## 6. Communication

There is **no text chat**.

Players coordinate through:

- their cursor positions;
- observing other players' cursors;
- the resulting movement of the Snake.

This is intentional: communication through collective movement is part of the game's central interaction.

---

## 7. Persistence

Persistent data includes:

- run history;
- collective high score;
- raw score for each run;
- multiplied collective score for each run;
- player count throughout each run;
- peak player count;
- average active player count;
- run duration;
- participant pseudonyms;
- individual participation results;
- cumulative global statistics;
- the path of the global-record Snake run.

The global-record path can be rendered in later games as a **ghost trail**, including the player cursor positions that produced that path, allowing future groups to see how the best previous group collectively controlled the Snake.

Ephemeral live cursor positions do not need to persist between ordinary sessions, except where cursor-position data is deliberately saved as part of a record-run ghost trail.

---

## 8. Scoring

### Collective Score

The primary score belongs to the group.

There are two collective score values for every run:

- **Raw Score** — the underlying Snake score before any multiplayer multiplier is applied.
- **Collective Score** — the final score after multiplayer bonuses are applied.

The collective score is the score used for:

- run records;
- historical rankings;
- the global high score;
- determining the global-record ghost trail.

The raw score remains visible in run history so that the effect of group size is transparent.

### Base Food Score

Each food item has a fixed server-controlled base value.

For example:

`baseFoodPoints = 100`

When the Snake collects food, the server calculates the points earned for that specific food event using the number of active players at that moment.

The multiplayer multiplier is therefore applied **per food event**, rather than once at the end of a run.

This prevents players who join near the end of a run from retroactively increasing the value of earlier achievements.

### Multiplayer Multiplier

For `n` active players:

`multiplier(n) = 1 + ((n - 2) / 10)^2`

where:

`2 <= n <= 12`

This creates an **increasing-return multiplier**.

Small groups receive only a modest bonus, while very large groups receive a substantially stronger reward because collective control becomes increasingly difficult as each player's individual influence becomes smaller.

The resulting multiplier is:

| Active Players | Individual Influence | Score Multiplier |
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

For each food collection:

`foodEventScore = baseFoodPoints × multiplier(activePlayers)`

The resulting value is rounded to the nearest whole point.

For example, with food worth 100 raw points:

- 2 players earn `100 × 1.00 = 100`;
- 4 players earn `100 × 1.04 = 104`;
- 8 players earn `100 × 1.36 = 136`;
- 12 players earn `100 × 2.00 = 200`.

The final collective score is:

`collectiveScore = sum(all foodEventScores)`

The raw score is:

`rawScore = sum(all baseFoodPoints)`

### Who Counts as an Active Player

A participant only counts toward `n` when they are actively influencing the Snake's centroid.

Therefore:

- active controller → **counts**;
- spectator/lobby user → **does not count**;
- player in the 2-second joining introduction → **does not count yet**;
- player who has disconnected and is flashing during the departure animation → **does not count**;
- player whose input has exceeded the stale-input timeout → **does not count**.

The scoring rule therefore follows the same definition of an active player as the control system:

**If a player influences the centroid, they count toward the multiplier. If they do not influence the centroid, they do not count toward the multiplier.**

### Personal Participation Score

Each participant also receives a personal **participation score** for the run.

This score represents their own involvement rather than individual victory.

It may take into account:

- how long the player actively participated;
- how many food collections occurred while they were active;
- whether they remained through the completion of the run;
- other cooperative contributions that can be measured without giving them greater control.

The exact participation calculation is **server-controlled and intentionally personalised**, so different players' participation scores are not designed to be directly comparable.

A player can use their participation score to track their **own personal best**, but there is no public participation leaderboard.

Participation scores must never:

- affect the collective score;
- affect the multiplayer multiplier;
- increase or decrease a player's influence over the Snake;
- create a competitive ranking between participants.

Every active player always retains exactly `1/n` control of the centroid.

---

## 9. Snake Rules and Restart

The game uses classic Snake failure rules.

The Snake dies when it:

- collides with a wall; or
- collides with itself.

After game over:

1. the completed run is saved;
2. the raw score is saved;
3. the final collective score is saved;
4. multiplayer/player-count statistics are saved;
5. individual participation results are saved;
6. persistent/global statistics are updated;
7. records are checked and updated;
8. the game displays the result;
9. an automatic countdown begins;
10. a new run starts if at least 2 players remain.

If fewer than 2 players remain, the next game waits until the minimum player count is restored.

---

## 10. Input

Every player controls the same conceptual **virtual cursor** regardless of device.

### Mouse

Mouse movement positions the virtual cursor.

### Touch

Touch users manipulate a **draggable virtual cursor**.

When they lift their finger, the cursor remains at its most recent location instead of returning to a default position.

### Keyboard

Keyboard users can move the same virtual cursor using:

- WASD; or
- arrow keys.

The game logic does not distinguish between these input methods once a virtual cursor position has been produced.

---

## 11. Coordinate System

Player positions are normalised rather than transmitted as raw pixels.

For example:

- `x = 0.0` means the left edge;
- `x = 1.0` means the right edge;
- `y = 0.0` means the top edge;
- `y = 1.0` means the bottom edge.

Therefore `(0.5, 0.5)` represents the centre regardless of viewport dimensions.

The group target is:

`centroid.x = sum(activePlayer.x) / activePlayerCount`

`centroid.y = sum(activePlayer.y) / activePlayerCount`

The Snake then **steers toward this target at a fixed movement speed**.

It does not teleport directly to the centroid.

---

## 12. Lag and Disconnects

The simulation is **server-authoritative**.

Clients submit player input, but the server determines:

- active players;
- centroid;
- Snake movement;
- collisions;
- food collection;
- raw score;
- multiplayer multiplier;
- collective score;
- game state.

Player inputs have a stale-input timeout.

If the server stops receiving valid input/connection activity from a participant for the configured timeout period, that participant is treated as disconnected rather than allowing an old cursor position to influence the Snake indefinitely.

Once timed out, that participant immediately stops:

- affecting the centroid;
- counting toward the multiplayer multiplier.

Normal disconnect behaviour then applies.

---

## 13. Group-Size Difficulty and Multiplier

Larger groups receive an increasingly strong score multiplier because coordination becomes more difficult as individual influence decreases.

For `n` active players, each player contributes exactly:

`1 / n`

of the resulting centroid.

At the minimum group size:

`2 players = 1/2 influence each = 50%`

At the maximum group size:

`12 players = 1/12 influence each ≈ 8.3%`

The multiplayer multiplier is:

`multiplier(n) = 1 + ((n - 2) / 10)^2`

for:

`2 <= n <= 12`

Unlike a diminishing-returns formula, this curve deliberately gives **increasing returns at larger group sizes**.

Moving from 2 to 4 players produces relatively little additional scoring benefit:

`×1.00 → ×1.04`

while moving toward the maximum group size produces substantially greater rewards:

`8 players = ×1.36`

`10 players = ×1.64`

`12 players = ×2.00`

This reflects the design intention that coordinating a very large group should be recognised as qualitatively harder than coordinating a small group.

The multiplier is:

- deterministic;
- calculated on the server;
- based only on active players;
- applied independently to each food collection.

The player count used for a food event is the number of active centroid-contributing players at the moment the server confirms that the food has been collected.

Run history records:

- raw score;
- collective multiplied score;
- player count changes;
- peak player count;
- average active player count.

This allows different runs to remain understandable even when their group sizes change during play.

---

## Core Invariants

The implementation should preserve these rules:

1. A game cannot run with fewer than 2 active players.
2. A game cannot contain more than 12 active players.
3. Every active player always contributes equally to the centroid.
4. Spectators/lobby users never affect gameplay.
5. Spectators/lobby users never affect the multiplayer multiplier.
6. A joining player does not affect the centroid or multiplier during their 2-second introduction.
7. A disconnected player stops affecting the centroid and multiplier immediately, even though their cursor remains visible and flashes for 2 seconds.
8. A stale/timed-out player cannot continue affecting control or scoring.
9. Falling below 2 players pauses rather than destroys the current run.
10. The same paused run can resume when another player joins.
11. Mouse, touch and keyboard all control the same virtual-cursor abstraction.
12. The multiplayer multiplier is calculated separately for every food collection.
13. Previously earned points cannot change when players join or leave later.
14. A 2-player food event uses a ×1.00 multiplier.
15. A 12-player food event uses a ×2.00 multiplier.
16. Collective achievements are more important than individual achievements.
17. Personal participation scores never alter collective scoring or player influence.
18. Completed runs and global records survive sessions, restarts and redeployments.
19. There is no single-player fallback or bot replacement for missing humans.