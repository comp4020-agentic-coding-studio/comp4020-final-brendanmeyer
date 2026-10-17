import type { ServerMessage } from "../shared/protocol.js";
import { PLAYER_COLORS } from "../shared/palette.js";
import { playerFlashAlpha } from "./flash.js";

type StateMessage = Extract<ServerMessage, { t: "state" }>;

// A waiting game never shows the snake -- there's nothing meaningful about
// its position before a second contributor to the centroid exists, and
// drawing it anyway (whether fresh at its starting position, or frozen
// mid-board for a paused, in-progress run) made the overlay text sitting
// on top of it hard to read.
export function shouldDrawSnake(status: StateMessage["status"]): boolean {
  return status !== "waiting";
}

// planning.md section 11: a local display setting, not part of the shared
// simulation -- defaults to hidden (hard mode), so a first-time visitor
// has to actually read the cursors and the snake's movement to find the
// group's shared target, rather than it being pointed out for them.
export function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: StateMessage,
  showCentroid = false,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1021";
  ctx.fillRect(0, 0, width, height);

  if (shouldDrawSnake(state.status)) {
    ctx.strokeStyle = "#6ee7b7";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    state.snake.path.forEach(([x, y], i) => {
      const px = x * width;
      const py = y * height;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  ctx.fillStyle = "#fbbf24";
  for (const food of state.food) {
    ctx.beginPath();
    ctx.arc(food.x * width, food.y * height, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showCentroid && state.centroid) {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.centroid.x * width, state.centroid.y * height, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(state.centroid.x * width - 5, state.centroid.y * height);
    ctx.lineTo(state.centroid.x * width + 5, state.centroid.y * height);
    ctx.moveTo(state.centroid.x * width, state.centroid.y * height - 5);
    ctx.lineTo(state.centroid.x * width, state.centroid.y * height + 5);
    ctx.stroke();
  }

  for (const player of state.players) {
    const alpha = playerFlashAlpha(player.state, player.flashMs);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PLAYER_COLORS[player.color] ?? "#60a5fa";
    ctx.beginPath();
    ctx.arc(player.x * width, player.y * height, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "12px sans-serif";
    ctx.fillText(player.name, player.x * width + 10, player.y * height - 10);
    ctx.globalAlpha = 1;
  }

  if (state.status === "waiting") {
    overlayText(
      ctx,
      width,
      height,
      "Waiting for a second player — open this page in another browser, or a private/incognito window",
    );
  } else if (state.status === "gameover") {
    overlayText(ctx, width, height, "Run over — a new one starts shortly");
  }
}

export interface GhostFrame {
  snakePath: [number, number][];
  players: { x: number; y: number; color: number }[];
}

// The current record run, replayed at reduced opacity by default
// (planning.md section 21) -- drawn on top of the live frame during play,
// visual only; call after draw() so it isn't cleared by draw()'s own
// clearRect. The stats page reuses this at full opacity (alpha: 1) as a
// standalone replay viewer rather than an overlay.
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: GhostFrame,
  alpha = 0.25,
): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  frame.snakePath.forEach(([x, y], i) => {
    const px = x * width;
    const py = y * height;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  for (const player of frame.players) {
    ctx.fillStyle = PLAYER_COLORS[player.color] ?? "#60a5fa";
    ctx.beginPath();
    ctx.arc(player.x * width, player.y * height, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function overlayText(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2, width - 40);
  ctx.textAlign = "left";
}
