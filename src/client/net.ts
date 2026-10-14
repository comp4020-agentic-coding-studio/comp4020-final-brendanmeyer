// Opens the game WebSocket, keeps the reconnect token and chosen colour in
// localStorage (so a returning visitor resumes the same identity and
// preference rather than claiming fresh ones), and exposes a tiny
// event-handler API to the rest of the client.

import type { ClientMessage, ServerMessage } from "../shared/protocol.js";

const TOKEN_KEY = "collective-snake-token";
const COLOR_KEY = "collective-snake-color";
const NAME_KEY = "collective-snake-name";

export function getStoredToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined; // private window, blocked storage, etc. -- just means no reconnect token
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // see getStoredToken -- losing the token just means claiming fresh next time
  }
}

export function getStoredColor(): number | undefined {
  try {
    const raw = localStorage.getItem(COLOR_KEY);
    return raw === null ? undefined : Number(raw);
  } catch {
    return undefined;
  }
}

function storeColor(color: number): void {
  try {
    localStorage.setItem(COLOR_KEY, String(color));
  } catch {
    // losing the preference just means picking fresh next time
  }
}

// The name actually in effect (resumed or newly claimed), not whatever was
// last typed -- a returning visitor's token always wins over a re-typed
// name (see ws.ts's handleHello), so this is what the entry screen should
// show back to them, not a stale or ignored guess.
export function getStoredName(): string | undefined {
  try {
    return localStorage.getItem(NAME_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // losing it just means the entry screen starts blank next time
  }
}

// Declining a takeover means this identity isn't who the visitor actually
// wants to be -- keeping its token/name/colour around would just resume the
// same still-elsewhere-active identity and hit the same prompt again next
// time, so this clears all three, leaving a blank entry screen ready to
// claim a genuinely new one.
export function clearStored(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(COLOR_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch {
    // nothing was going to be remembered anyway
  }
}

export interface NetHandlers {
  onIdentity: (name: string, color: number) => void;
  onState: (state: Extract<ServerMessage, { t: "state" }>) => void;
  // A tab sharing this browser's localStorage already resumed this token.
  // The caller decides (e.g. via a dialog) and calls Net.takeOver() if so.
  onAlreadyConnected: (name: string) => void;
  // The server closed this socket -- most likely another tab took over.
  onDisconnected: () => void;
  onNameTaken: () => void;
  // Reply to Net.setPassword(). reason is only set on a refusal
  // ("alreadyHasPassword" | "blank") -- this doesn't change a password
  // that's already set, only adds one where there was none.
  onPasswordSet: (ok: boolean, reason?: string) => void;
}

export interface Net {
  sendInput: (x: number, y: number) => void;
  takeOver: () => void;
  requestJoin: () => void;
  acceptOffer: () => void;
  declineOffer: () => void;
  setPassword: (password: string) => void;
}

export function connect(name: string, color: number, password: string, handlers: NetHandlers): Net {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${location.host}/ws`);

  function sendHello(takeover?: boolean): void {
    const hello: ClientMessage = { t: "hello", token: getStoredToken(), name, color, password, takeover };
    socket.send(JSON.stringify(hello));
  }

  socket.addEventListener("open", () => sendHello());

  socket.addEventListener("message", (event) => {
    const msg: ServerMessage = JSON.parse(event.data);
    if (msg.t === "welcome") {
      storeToken(msg.token);
      storeColor(msg.color);
      storeName(msg.name);
      handlers.onIdentity(msg.name, msg.color);
    } else if (msg.t === "nameInvalid") {
      storeToken(msg.token);
      storeColor(msg.color);
      storeName(msg.assigned);
      handlers.onIdentity(msg.assigned, msg.color);
    } else if (msg.t === "alreadyConnected") {
      handlers.onAlreadyConnected(msg.name);
    } else if (msg.t === "nameTaken") {
      handlers.onNameTaken();
    } else if (msg.t === "state") {
      handlers.onState(msg);
    } else if (msg.t === "passwordSet") {
      handlers.onPasswordSet(msg.ok, msg.reason);
    }
  });

  socket.addEventListener("close", () => handlers.onDisconnected());

  function send(message: ClientMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  return {
    sendInput: (x, y) => send({ t: "input", x, y }),
    takeOver: () => sendHello(true),
    requestJoin: () => send({ t: "requestJoin" }),
    acceptOffer: () => send({ t: "acceptOffer" }),
    declineOffer: () => send({ t: "declineOffer" }),
    setPassword: (password) => send({ t: "setPassword", password }),
  };
}
