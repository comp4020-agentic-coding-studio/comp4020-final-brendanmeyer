// The 11-step tick order from planning.md section 15, simplified to this
// week's scope: sweep (role timeouts) -> active set -> centroid -> steer ->
// collide -> score -> spawn -> broadcast. "Active" for simulation purposes
// is specifically role === "active" -- introducing/leaving/resuming have a
// cursor on screen but don't contribute, per planning.md sections 4 and 5.

import { connections, offerRemainingMs, queuePositionOf, sweep, type Connection } from "../ws.ts";
import { recordRun, saveReplaySamples } from "../db/repo.ts";
import { foodEventScore, multiplier } from "../../shared/scoring.ts";
import type { CursorRole } from "./roles.ts";
import { buildYourView, countsTowardSimulation, hasCursor } from "./roles.ts";
import type { ServerMessage, StateMessage, YourView } from "../../shared/protocol.ts";
import { centroid } from "./centroid.ts";
import { eatsFood, spawnFood } from "./food.ts";
import { logEvent } from "../log.ts";
import { applySpeedCap, pickProgression, SPEED_STEP } from "./progression.ts";
import { createReplayBuffer, maybeSample, takeSamples } from "./replay.ts";
import { advance, hitsSelf, hitsWall, steer } from "./snake.ts";
import { freshState, GAME_OVER_RESET_MS, getState, setState, TICK_MS } from "./state.ts";

let runStartedAt = Date.now();
let peakPlayersThisRun = 0;
let foodEventsThisRun = 0;
let activeMsThisRun = 0;
let replayBuffer = createReplayBuffer();

// A connection's own `you` differs per recipient (its role, its own
// countdown), so unlike every other field this can't be computed once and
// shared across every socket's payload.
function broadcast(): void {
  const state = getState();
  const now = Date.now();
  const all = [...connections.values()];
  const withCursor = all.filter((c) => hasCursor(c.role));
  const activePlayers = withCursor.filter((c) => c.role === "active");
  const activeCount = activePlayers.length;
  const shared: Omit<StateMessage, "you"> = {
    t: "state",
    status: state.status,
    pausedWithRun: state.pausedWithRun,
    activeCount,
    players: withCursor.map((c) => ({
      id: c.playerId,
      name: c.name,
      x: c.lastInput.x,
      y: c.lastInput.y,
      color: c.colorIndex ?? 0,
      state: c.role as CursorRole,
      flashMs: now - c.roleChangedAt,
    })),
    snake: { path: state.snake.map((p): [number, number] => [p.x, p.y]) },
    food: state.food,
    centroid: activeCount > 0 ? centroid(activePlayers.map((c) => c.lastInput)) : null,
    rawScore: state.rawScore,
    collectiveScore: state.collectiveScore,
    multiplier: activeCount >= 2 ? multiplier(Math.min(activeCount, 12)) : 1,
  };
  for (const conn of all) {
    if (conn.socket.readyState !== conn.socket.OPEN) continue;
    const you = buildYou(conn, now);
    const message: ServerMessage = { ...shared, you };
    conn.socket.send(JSON.stringify(message));
  }
}

// buildYourView alone can't build "queued"/"offered" (it only knows a
// role/timestamp, not the queue's actual contents) -- those two are
// overridden here with the real position/size/remainingMs from ws.ts's
// queue accessors.
function buildYou(conn: Connection, now: number): YourView {
  if (conn.role === "queued") {
    const position = queuePositionOf(conn.playerId);
    if (position) return { role: "queued", ...position };
  }
  if (conn.role === "offered") {
    const remainingMs = offerRemainingMs(conn.playerId, now);
    if (remainingMs !== null) return { role: "offered", remainingMs };
  }
  return buildYourView(conn.role, conn.roleChangedAt, now);
}

function finalizeRun(active: Connection[]): void {
  const state = getState();
  const endedAt = Date.now();
  const { runId, isRecord } = recordRun({
    startedAt: runStartedAt,
    endedAt,
    rawScore: state.rawScore,
    collectiveScore: state.collectiveScore,
    peakPlayers: peakPlayersThisRun,
    playerIds: active.map((c) => c.playerId),
    foodEvents: foodEventsThisRun,
    activeMs: activeMsThisRun,
  });
  const samples = takeSamples(replayBuffer);
  if (isRecord) saveReplaySamples(runId, samples);
  logEvent("run_finished", null, {
    runId,
    startedAt: runStartedAt,
    endedAt,
    rawScore: state.rawScore,
    collectiveScore: state.collectiveScore,
    isRecord,
    players: active.map((c) => ({ playerId: c.playerId, name: c.name })),
  });
  setState({ ...state, status: "gameover" });
  setTimeout(() => {
    setState(freshState());
  }, GAME_OVER_RESET_MS);
}

function tick(): void {
  sweep(Date.now());

  let state = getState();

  if (state.status === "gameover") {
    broadcast();
    return; // waiting on the reset timer set by finalizeRun
  }

  const active = [...connections.values()].filter((c) => countsTowardSimulation(c.role));
  const n = active.length;

  if (n < 2) {
    if (state.status === "running") {
      state = { ...state, status: "waiting", pausedWithRun: true };
      setState(state);
    }
    broadcast();
    return;
  }

  if (state.status === "waiting") {
    state = {
      ...state,
      status: "running",
      food: state.food ?? spawnFood(state.snake),
      pausedWithRun: false,
    };
    setState(state);
    runStartedAt = Date.now();
    peakPlayersThisRun = 0;
    foodEventsThisRun = 0;
    activeMsThisRun = 0;
    replayBuffer = createReplayBuffer();
  }
  peakPlayersThisRun = Math.max(peakPlayersThisRun, n);
  activeMsThisRun += TICK_MS;

  const target = centroid(active.map((c) => c.lastInput));
  const head = state.snake[0];
  const direction = steer(state.direction, target, head);
  const newHead = { x: head.x + direction.x * state.snakeSpeed, y: head.y + direction.y * state.snakeSpeed };

  if (hitsWall(newHead) || hitsSelf(newHead, state.snake)) {
    finalizeRun(active);
    broadcast();
    return;
  }

  const ateFood = eatsFood(newHead, state.food);
  // planning.md section 12: exactly one of two bonuses per pickup, chosen
  // at random -- never both. "grow" is today's existing advance() growth;
  // "speedUp" instead leaves the snake's length unchanged and bumps its
  // speed, capped so the game stays controllable.
  const progression = ateFood ? pickProgression(Math.random) : null;
  const grow = progression === "grow";
  let snakeSpeed = state.snakeSpeed;
  if (progression === "speedUp") snakeSpeed = applySpeedCap(snakeSpeed + SPEED_STEP);

  if (ateFood) {
    foodEventsThisRun += 1;
    const rawScore = state.rawScore + 100;
    const collectiveScore = state.collectiveScore + foodEventScore(n);
    logEvent("food_eaten", null, {
      players: active.map((c) => ({ playerId: c.playerId, name: c.name })),
      rawScore,
      collectiveScore,
      n,
      progression,
    });
    state = { ...state, rawScore, collectiveScore };
  }

  const snake = advance(state.snake, newHead, grow);
  const food = ateFood ? spawnFood(snake) : state.food;
  state = { ...state, snake, direction, food, snakeSpeed };
  setState(state);

  maybeSample(replayBuffer, Date.now(), runStartedAt, {
    snakePath: state.snake.map((p): [number, number] => [p.x, p.y]),
    players: active.map((c) => ({ id: c.playerId, name: c.name, x: c.lastInput.x, y: c.lastInput.y, color: c.colorIndex ?? 0 })),
    rawScore: state.rawScore,
    collectiveScore: state.collectiveScore,
    activeCount: n,
  });

  broadcast();
}

export function startGameLoop(): void {
  setInterval(tick, TICK_MS);
}
