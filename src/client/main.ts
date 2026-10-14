import { clearStored, connect, getStoredToken } from "./net.js";
import { collectEntry } from "./entry.js";
import { showDialog } from "./dialog.js";
import { trackInput } from "./input.js";
import { draw, drawGhost } from "./render.js";
import { setupFullscreen } from "./fullscreen.js";
import { createGhostState, currentGhostFrame, refreshGhost } from "./ghost.js";
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
const fullscreenBtn = required(document.querySelector<HTMLButtonElement>("#fullscreen"), "missing #fullscreen button");
const entryOverlay = required(document.querySelector<HTMLElement>("#entry"), "missing #entry overlay");
const nameInput = required(document.querySelector<HTMLInputElement>("#name-input"), "missing #name-input");
const passwordInput = required(document.querySelector<HTMLInputElement>("#password-input"), "missing #password-input");
const swatchContainer = required(document.querySelector<HTMLElement>("#swatches"), "missing #swatches");
const playButton = required(document.querySelector<HTMLButtonElement>("#play"), "missing #play button");
const requestJoinBtn = required(document.querySelector<HTMLButtonElement>("#request-join"), "missing #request-join");
const acceptOfferBtn = required(document.querySelector<HTMLButtonElement>("#accept-offer"), "missing #accept-offer");
const declineOfferBtn = required(document.querySelector<HTMLButtonElement>("#decline-offer"), "missing #decline-offer");
const passwordUi = required(document.querySelector<HTMLElement>("#password-ui"), "missing #password-ui");
const setPasswordInput = required(document.querySelector<HTMLInputElement>("#set-password-input"), "missing #set-password-input");
const setPasswordBtn = required(document.querySelector<HTMLButtonElement>("#set-password-btn"), "missing #set-password-btn");
const passwordStatusEl = required(document.querySelector<HTMLElement>("#password-status"), "missing #password-status");
const queueStatusText = document.createTextNode("");
required(document.querySelector<HTMLElement>("#queue-status"), "missing #queue-status").prepend(queueStatusText);
const dialogElements = {
  overlay: required(document.querySelector<HTMLElement>("#dialog"), "missing #dialog overlay"),
  message: required(document.querySelector<HTMLElement>("#dialog-message"), "missing #dialog-message"),
  confirmButton: required(document.querySelector<HTMLButtonElement>("#dialog-confirm"), "missing #dialog-confirm"),
  cancelButton: required(document.querySelector<HTMLButtonElement>("#dialog-cancel"), "missing #dialog-cancel"),
};

setupFullscreen(fullscreenBtn);

function resize(): void {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener("resize", resize);
resize();

let latestState: StateMessage | null = null;
let previousStatus: StateMessage["status"] | null = null;

const ghostState = createGhostState();
void refreshGhost(ghostState);
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "g") ghostState.enabled = !ghostState.enabled;
});

function updateQueueUi(you: StateMessage["you"]): void {
  requestJoinBtn.hidden = you.role !== "spectator";
  acceptOfferBtn.hidden = you.role !== "offered";
  declineOfferBtn.hidden = you.role !== "offered";
  queueStatusText.textContent =
    you.role === "spectator"
      ? "You're spectating. "
      : you.role === "queued"
        ? `Waiting in line: position ${you.position} of ${you.size}. `
        : you.role === "offered"
          ? `A slot's open for you (${Math.ceil(you.remainingMs / 1000)}s to claim it). `
          : "";
}

async function start(): Promise<void> {
  const { name, color, password } = await collectEntry({
    nameInput,
    passwordInput,
    swatchContainer,
    playButton,
  });

  const { sendInput, takeOver, requestJoin, acceptOffer, declineOffer, setPassword } = connect(name, color, password, {
    onIdentity: (identityName) => {
      // Only hidden once a real identity is confirmed -- a hello can still
      // come back "already taken" or "already playing elsewhere" instead,
      // which needs showing on this screen, not over an unentered game.
      entryOverlay.hidden = true;
      statusEl.textContent = `Playing as ${identityName}`;
      // The client has no way to know in advance whether this identity
      // already has a password -- setPassword safely refuses either way,
      // so the control just stays offered; a successful set or an
      // "already has one" reply both resolve the question for this
      // session (see onPasswordSet below).
      passwordUi.hidden = false;
    },
    onState: (state) => {
      latestState = state;
      scoreEl.textContent =
        `Score: ${state.rawScore} · Collective: ${state.collectiveScore} ` +
        `(×${state.multiplier.toFixed(2)}) · Players: ${state.activeCount}`;
      updateQueueUi(state.you);
      // A run just ended -- it might have been a new record, so refresh
      // the ghost rather than waiting indefinitely for a stale one.
      if (state.status === "gameover" && previousStatus !== "gameover") void refreshGhost(ghostState);
      previousStatus = state.status;
    },
    // A tab sharing this browser's localStorage already resumed this token --
    // this one isn't playing until the visitor confirms taking over.
    onAlreadyConnected: (takenName) => {
      statusEl.textContent = `${takenName} is already playing in another tab`;
      void showDialog(
        dialogElements,
        `${takenName} is already being played in another tab. Take over and play here instead?`,
        "confirm",
      ).then((confirmed) => {
        if (confirmed) {
          takeOver();
        } else {
          // Not this identity, then -- clear it so a retry claims someone
          // new instead of hitting the same "already playing" prompt again.
          clearStored();
          location.reload();
        }
      });
    },
    onDisconnected: () => {
      statusEl.textContent = "Disconnected — likely taken over from another tab";
    },
    onNameTaken: () => {
      // Simplest correct thing: reload rather than re-running start() in
      // place, which would register every one of its listeners a second
      // time (queue buttons, input tracking) on top of the first set.
      void showDialog(dialogElements, "That name is already taken -- pick another.", "alert").then(() => {
        location.reload();
      });
    },
    onPasswordSet: (ok, reason) => {
      if (ok) {
        passwordStatusEl.textContent = "Password set.";
        passwordUi.hidden = true;
      } else if (reason === "alreadyHasPassword") {
        passwordStatusEl.textContent = "This name already has a password.";
        passwordUi.hidden = true;
      } else {
        passwordStatusEl.textContent = "Enter a password first.";
      }
      setPasswordInput.value = "";
    },
  });

  requestJoinBtn.addEventListener("click", () => requestJoin());
  acceptOfferBtn.addEventListener("click", () => acceptOffer());
  declineOfferBtn.addEventListener("click", () => declineOffer());
  setPasswordBtn.addEventListener("click", () => setPassword(setPasswordInput.value));

  trackInput(canvas, (pos) => sendInput(pos.x, pos.y));
}
void start();

function frame(): void {
  if (latestState) draw(ctx, canvas.width, canvas.height, latestState);
  const ghostFrame = currentGhostFrame(ghostState, performance.now());
  if (ghostFrame) drawGhost(ctx, canvas.width, canvas.height, ghostFrame);
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
