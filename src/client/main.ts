import { clearStored, connect, getStoredToken } from "./net.js";
import { collectEntry } from "./entry.js";
import { showDialog } from "./dialog.js";
import { showSetPasswordDialog } from "./passwordDialog.js";
import { showStatsDialog } from "./statsDialog.js";
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
const setPasswordBtn = required(document.querySelector<HTMLButtonElement>("#set-password-btn"), "missing #set-password-btn");
const changeUserBtn = required(document.querySelector<HTMLButtonElement>("#change-user-btn"), "missing #change-user-btn");
const statsBtn = required(document.querySelector<HTMLButtonElement>("#stats-btn"), "missing #stats-btn");
const helpBtn = required(document.querySelector<HTMLButtonElement>("#help-btn"), "missing #help-btn");
const helpOverlay = required(document.querySelector<HTMLElement>("#help-dialog"), "missing #help-dialog overlay");
const helpCloseBtn = required(document.querySelector<HTMLButtonElement>("#help-dialog-close"), "missing #help-dialog-close");
const queueStatusText = document.createTextNode("");
required(document.querySelector<HTMLElement>("#queue-status"), "missing #queue-status").prepend(queueStatusText);
const dialogElements = {
  overlay: required(document.querySelector<HTMLElement>("#dialog"), "missing #dialog overlay"),
  message: required(document.querySelector<HTMLElement>("#dialog-message"), "missing #dialog-message"),
  confirmButton: required(document.querySelector<HTMLButtonElement>("#dialog-confirm"), "missing #dialog-confirm"),
  cancelButton: required(document.querySelector<HTMLButtonElement>("#dialog-cancel"), "missing #dialog-cancel"),
};
const passwordDialogElements = {
  overlay: required(document.querySelector<HTMLElement>("#password-dialog"), "missing #password-dialog overlay"),
  input: required(document.querySelector<HTMLInputElement>("#password-dialog-input"), "missing #password-dialog-input"),
  confirmButton: required(document.querySelector<HTMLButtonElement>("#password-dialog-confirm"), "missing #password-dialog-confirm"),
  cancelButton: required(document.querySelector<HTMLButtonElement>("#password-dialog-cancel"), "missing #password-dialog-cancel"),
  errorEl: required(document.querySelector<HTMLElement>("#password-dialog-error"), "missing #password-dialog-error"),
};
const statsDialogElements = {
  overlay: required(document.querySelector<HTMLElement>("#stats-dialog"), "missing #stats-dialog overlay"),
  closeButton: required(document.querySelector<HTMLButtonElement>("#stats-dialog-close"), "missing #stats-dialog-close"),
  statsEl: required(document.querySelector<HTMLElement>("#stats"), "missing #stats element"),
  recordsEl: required(document.querySelector<HTMLElement>("#records"), "missing #records element"),
  replayCanvas: required(document.querySelector<HTMLCanvasElement>("#replay"), "missing #replay canvas"),
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
// Read by the stats dialog's close handler (statsDialog.ts's
// shouldReturnToEntryOnClose) to decide where closing it goes -- back to
// the game it was laid over if still connected, or the entry screen if
// that connection was already gone before the dialog even opened.
let connected = false;

const ghostState = createGhostState();
void refreshGhost(ghostState);
// planning.md section 11: a local display setting only -- never reaches the
// server, same as the ghost-trail toggle below. Defaults to hidden (hard
// mode), matching render.ts's own default.
let showCentroid = false;
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "g") ghostState.enabled = !ghostState.enabled;
  if (key === "c") showCentroid = !showCentroid;
});

// Static reference content, not tied to any connection state -- wired
// outside start() the same way setupFullscreen already is, so it works
// before an identity is even confirmed.
helpBtn.addEventListener("click", () => {
  helpOverlay.hidden = false;
});
helpCloseBtn.addEventListener("click", () => {
  helpOverlay.hidden = true;
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
    onIdentity: (identityName, _color, hasPassword) => {
      // Only hidden once a real identity is confirmed -- a hello can still
      // come back "already taken" or "already playing elsewhere" instead,
      // which needs showing on this screen, not over an unentered game.
      entryOverlay.hidden = true;
      statusEl.textContent = `Playing as ${identityName}`;
      // The server now says up front whether this identity already has a
      // password -- only an unprotected name gets offered the option at
      // all, rather than always showing it and reacting to a refusal.
      setPasswordBtn.hidden = hasPassword;
      // Only meaningful once there's an actual identity in play to leave --
      // the entry screen's own stored-token check (entry.ts) already
      // covers "nothing to change yet" for a fresh visitor.
      changeUserBtn.hidden = false;
      connected = true;
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
      connected = false;
    },
    onNameTaken: () => {
      // Simplest correct thing: reload rather than re-running start() in
      // place, which would register every one of its listeners a second
      // time (queue buttons, input tracking) on top of the first set.
      void showDialog(dialogElements, "That name is already taken -- pick another.", "alert").then(() => {
        location.reload();
      });
    },
    onPasswordSet: (ok) => {
      // "alreadyHasPassword" shouldn't be reachable from this dialog at
      // all now that the button only shows when hasPassword was false,
      // but hiding on any settled outcome either way is still correct: a
      // refusal here means nothing changed, and the button's prior
      // visibility (based on the still-accurate hasPassword from welcome)
      // already reflected that.
      if (ok) setPasswordBtn.hidden = true;
    },
  });

  requestJoinBtn.addEventListener("click", () => requestJoin());
  acceptOfferBtn.addEventListener("click", () => acceptOffer());
  declineOfferBtn.addEventListener("click", () => declineOffer());
  setPasswordBtn.addEventListener("click", () => {
    void showSetPasswordDialog(passwordDialogElements).then((typed) => {
      if (typed !== null) setPassword(typed);
    });
  });
  // planning.md's "explicitly starting a new login/session" -- the same
  // clear-and-reload already used when declining a takeover offer for an
  // identity that isn't wanted, just reachable deliberately instead of
  // only as a side effect of that other flow.
  changeUserBtn.addEventListener("click", () => {
    clearStored();
    location.reload();
  });
  statsBtn.addEventListener("click", () => {
    void showStatsDialog(statsDialogElements, () => connected).then((toEntry) => {
      // "Back to the game" needs nothing further -- the dialog's own
      // close already hid it over an unpaused game underneath. Only the
      // disconnected case needs an actual navigation, since there's no
      // live game left for the dialog to have been laid over.
      if (toEntry) location.reload();
    });
  });

  trackInput(canvas, (pos) => sendInput(pos.x, pos.y));
}
void start();

function frame(): void {
  if (latestState) draw(ctx, canvas.width, canvas.height, latestState, showCentroid);
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
