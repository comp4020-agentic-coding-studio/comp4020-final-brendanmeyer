// The 11-step tick order from planning.md section 15, simplified to this
// week's scope: sweep (role timeouts) -> active set -> centroid -> steer ->
// collide -> score -> spawn -> broadcast. "Active" for simulation purposes
// is specifically role === "active" -- introducing/leaving/resuming have a
// cursor on screen but don't contribute, per planning.md sections 4 and 5.

import { connections, sweep } from "../ws.ts";
import { recordRun } from "../db/repo.ts";
import { foodEventScore, multiplier } from "../../shared/scoring.ts";
import type { CursorRole } from "./roles.ts";
import { countsTowardSimulation, hasCursor } from "./roles.ts";
import type { ServerMessage } from "../../shared/protocol.ts";
import { centroid } from "./centroid.ts";
import { eatsFood, spawnFood } from "./food.ts";
import { advance, hitsSelf, hitsWall, steer } from "./snake.ts";
import { freshState, GAME_OVER_RESET_MS, SNAKE_SPEED, TICK_MS, type GameState } from "./state.ts";

let state: GameState = freshState();
let runStartedAt = Date.now();
let peakPlayersThisRun = 0;

function broadcast(): void {
  const withCursor = [...connections.values()].filter((c) => hasCursor(c.role));
  const activeCount = withCursor.filter((c) => c.role === "active").length;
  const message: ServerMessage = {
    t: "state",
    status: state.status,
    pausedWithRun: state.pausedWithRun,
    activeCount,
    players: withCursor.map((c) => ({
      id: c.playerId,
      name: c.name,
      x: c.lastInput.x,
      y: c.lastInput.y,
      state: c.role as CursorRole,
    })),
    snake: { path: state.snake.map((p): [number, number] => [p.x, p.y]) },
    food: state.food,
    rawScore: state.rawScore,
    collectiveScore: state.collectiveScore,
    multiplier: activeCount >= 2 ? multiplier(Math.min(activeCount, 12)) : 1,
  };
  const payload = JSON.stringify(message);
  for (const conn of connections.values()) {
    if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(payload);
  }
}

function finalizeRun(active: { playerId: number }[]): void {
  recordRun({
    startedAt: runStartedAt,
    endedAt: Date.now(),
    rawScore: state.rawScore,
    collectiveScore: state.collectiveScore,
    peakPlayers: peakPlayersThisRun,
    playerIds: active.map((c) => c.playerId),
  });
  state = { ...state, status: "gameover" };
  setTimeout(() => {
    state = freshState();
  }, GAME_OVER_RESET_MS);
}

function tick(): void {
  sweep(Date.now());

  if (state.status === "gameover") {
    broadcast();
    return; // waiting on the reset timer set by finalizeRun
  }

  const active = [...connections.values()].filter((c) => countsTowardSimulation(c.role));
  const n = active.length;

  if (n < 2) {
    if (state.status === "running") state = { ...state, status: "waiting", pausedWithRun: true };
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
    runStartedAt = Date.now();
    peakPlayersThisRun = 0;
  }
  peakPlayersThisRun = Math.max(peakPlayersThisRun, n);

  const target = centroid(active.map((c) => c.lastInput));
  const head = state.snake[0];
  const direction = steer(state.direction, target, head);
  const newHead = { x: head.x + direction.x * SNAKE_SPEED, y: head.y + direction.y * SNAKE_SPEED };

  if (hitsWall(newHead) || hitsSelf(newHead, state.snake)) {
    finalizeRun(active);
    broadcast();
    return;
  }

  const grow = eatsFood(newHead, state.food);
  if (grow) {
    state = {
      ...state,
      rawScore: state.rawScore + 100,
      collectiveScore: state.collectiveScore + foodEventScore(n),
    };
  }

  const snake = advance(state.snake, newHead, grow);
  const food = grow ? spawnFood(snake) : state.food;
  state = { ...state, snake, direction, food };

  broadcast();
}

export function startGameLoop(): void {
  setInterval(tick, TICK_MS);
}
