import { connect, getStoredToken } from "./net.js";
import { trackInput } from "./input.js";
import { draw } from "./render.js";
import type { ServerMessage } from "../shared/protocol.js";

type StateMessage = Extract<ServerMessage, { t: "state" }>;

// Named bindings (rather than a null check further down) so every closure
// below sees a definite, non-null type -- control-flow narrowing from an
// early guard doesn't carry into functions defined later in the file.
function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

const canvas = required(document.querySelector<HTMLCanvasElement>("#game"), "missing #game canvas");
const statusEl = required(document.querySelector<HTMLElement>("#status"), "missing #status element");
const scoreEl = required(document.querySelector<HTMLElement>("#score"), "missing #score element");
const lastRunEl = required(document.querySelector<HTMLElement>("#last-run"), "missing #last-run element");
const ctx = required(canvas.getContext("2d"), "2d canvas context unavailable");

function resize(): void {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener("resize", resize);
resize();

let latestState: StateMessage | null = null;

const { sendInput } = connect({
  onIdentity: (name) => {
    statusEl.textContent = `Playing as ${name}`;
  },
  onState: (state) => {
    latestState = state;
    scoreEl.textContent =
      `Score: ${state.rawScore} · Collective: ${state.collectiveScore} ` +
      `(×${state.multiplier.toFixed(2)}) · Players: ${state.activeCount}`;
  },
});

trackInput(canvas, (pos) => sendInput(pos.x, pos.y));

function frame(): void {
  if (latestState) draw(ctx, canvas.width, canvas.height, latestState);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

async function loadSummary(): Promise<void> {
  const token = getStoredToken();
  const url = token ? `/api/summary?token=${encodeURIComponent(token)}` : "/api/summary";
  try {
    const res = await fetch(url);
    const summary = await res.json();
    lastRunEl.textContent = summary.yourLastRun
      ? `Last time: ${summary.yourLastRun.score} raw / ${summary.yourLastRun.collectiveScore} collective`
      : "No previous run yet.";
  } catch {
    lastRunEl.textContent = "";
  }
}
// Gives the WS handshake a moment to persist a token before checking.
setTimeout(loadSummary, 500);
