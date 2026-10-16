export interface Vec2 {
  x: number;
  y: number;
}

export type Status = "waiting" | "running" | "gameover";

export interface GameState {
  status: Status;
  snake: Vec2[]; // head first
  direction: Vec2; // unit vector
  // planning.md section 13: up to the active player count, weighted toward
  // fewer -- never a single nullable item. Empty means none spawned yet.
  food: Vec2[];
  rawScore: number;
  collectiveScore: number;
  // True once a running game has dropped below 2 active players and its
  // state is being preserved rather than ended (planning.md section 5's "if
  // fewer than 2 remain, pause"). Never sent on the wire -- the waiting and
  // paused UI are identical; it only decides server-side whether a newly
  // activated connection gets the 5-second resume countdown (section 7) or
  // the normal 2-second join introduction (section 4).
  pausedWithRun: boolean;
  // planning.md section 12: bumped by progression.ts's "speedUp" choice on
  // a food pickup, capped there too. Resets to SNAKE_SPEED each run
  // (freshState), same as every other per-run field here.
  snakeSpeed: number;
}

export const TICK_MS = 66; // ~15Hz
export const SNAKE_SPEED = 0.01; // normalized units per tick
export const INITIAL_SNAKE_LENGTH = 5;
export const GAME_OVER_RESET_MS = 5000;

export function initialSnake(): Vec2[] {
  const snake: Vec2[] = [];
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    snake.push({ x: 0.5 - i * 0.02, y: 0.5 });
  }
  return snake;
}

export function freshState(): GameState {
  return {
    status: "waiting",
    snake: initialSnake(),
    direction: { x: 1, y: 0 },
    food: [],
    rawScore: 0,
    collectiveScore: 0,
    pausedWithRun: false,
    snakeSpeed: SNAKE_SPEED,
  };
}

// The single current GameState, owned here rather than inside loop.ts, so
// ws.ts can read status/pausedWithRun (to decide a newly-registered
// connection's role) without importing from loop.ts -- loop.ts already
// imports from ws.ts (connections, sweep), and a module can't import both
// ways.
let current: GameState = freshState();

export function getState(): GameState {
  return current;
}

export function setState(next: GameState): void {
  current = next;
}
