export interface Vec2 {
  x: number;
  y: number;
}

export type Status = "waiting" | "running" | "gameover";

export interface GameState {
  status: Status;
  snake: Vec2[]; // head first
  direction: Vec2; // unit vector
  food: Vec2 | null;
  rawScore: number;
  collectiveScore: number;
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
    food: null,
    rawScore: 0,
    collectiveScore: 0,
  };
}
