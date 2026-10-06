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

---

## 4. Leaving an Active Game

If a player leaves while **2 or more players will remain**, their cursor does not disappear instantly.

Instead:

1. their cursor flashes for 2 seconds;
2. it stops contributing to the centroid when they are considered disconnected;
3. after the 2-second visual departure animation, the cursor disappears.

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

Lobby users do not affect the centroid.

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
- player count for each run;
- run duration;
- participant pseudonyms;
- cumulative global statistics;
- the path of the global-record Snake run.

The global-record path can be rendered in later games as a **ghost trail** (include the player mouse positions), allowing future groups to see the path created by the best previous group.

Ephemeral information such as live cursor positions does not need to persist between sessions.

---

## 8. Scoring

### Collective Score

The primary score belongs to the group.

The collective score is based on normal Snake progression, such as food collected and resulting Snake length.

Only the collective score is eligible for:

- run records;
- historical rankings;
- the global high score;
- the global-record ghost trail.

### Personal Participation Score

Each participant may also receive a personal **participation score** (make the calcuation different for each play, so they cannot compare, and so they can have their own personal best **-&#x20;**&#x54;he exact multiplier formula should  server-controlled) for that run.

This represents participation rather than individual victory.

It may take into account:

- how long the player actively participated;
- how many successful food collections occurred while they were active;
- whether they remained through the completion of the run;
- other cooperative contributions that can be measured without assigning greater control to one person.

Participation scores should **not create a competitive individual leaderboard**.

They should also never change a player's influence over the Snake. Every player always retains exactly `1/n` control.

---

## 9. Snake Rules and Restart

The game uses classic Snake failure rules.

The Snake dies when it:

- collides with a wall; or
- collides with itself.

After game over:

1. the completed run is saved;
2. persistent/global statistics are updated;
3. records are checked and updated;
4. the game displays the result;
5. an automatic countdown begins;
6. a new run starts if at least 2 players remain.

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
- score;
- game state.

Player inputs have a stale-input timeout.

If the server stops receiving valid input/connection activity from a participant for the configured timeout period, that participant is treated as disconnected rather than allowing an old cursor position to influence the Snake indefinitely.

Normal disconnect behaviour then applies.

---

## 13. Group-Size Difficulty and Multiplier

Larger groups receive a score multiplier because coordination becomes increasingly difficult as individual influence decreases.

For `n` active players, each player controls only:

`1 / n`

of the resulting centroid.

The exact multiplier formula should remain deterministic and server-controlled.

The multiplier should increase gradually rather than making large groups overwhelmingly more valuable than small ones.

The run history should record both:

- the raw Snake result; and
- the resulting multiplied score.

This makes comparisons between different group sizes understandable.

---

## Core Invariants

The implementation should preserve these rules:

1. A game cannot run with fewer than 2 active players.
2. A game cannot contain more than 12 active players.
3. Every active player always contributes equally to the centroid.
4. Spectators/lobby users never affect gameplay.
5. A joining player does not affect the centroid during their 2-second introduction.
6. A disconnected player cannot continue influencing the game indefinitely.
7. Falling below 2 players pauses rather than destroys the current run.
8. The same paused run can resume when another player joins.
9. Mouse, touch and keyboard all control the same virtual-cursor abstraction.
10. Collective achievements are more important than individual achievements.
11. Completed runs and global records survive sessions, restarts and redeployments.
12. There is no single-player fallback or bot replacement for missing humans.
