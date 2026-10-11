import type { ServerMessage } from "../shared/protocol.js";
import { PLAYER_COLORS } from "../shared/palette.js";
import { playerFlashAlpha } from "./flash.js";

type StateMessage = Extract<ServerMessage, { t: "state" }>;

// A paused run (status "waiting" with a preserved run) hides the snake
// rather than showing it frozen mid-board; only the fresh, never-started
// waiting state still shows it at its starting position.
export function shouldDrawSnake(status: StateMessage["status"], pausedWithRun: boolean): boolean {
  return !(status === "waiting" && pausedWithRun);
}

export function draw(ctx: CanvasRenderingContext2D, width: number, height: number, state: StateMessage): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1021";
  ctx.fillRect(0, 0, width, height);

  if (shouldDrawSnake(state.status, state.pausedWithRun)) {
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

  if (state.food) {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(state.food.x * width, state.food.y * height, 8, 0, Math.PI * 2);
    ctx.fill();
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

function overlayText(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "18px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, width / 2, height / 2, width - 40);
  ctx.textAlign = "left";
}
