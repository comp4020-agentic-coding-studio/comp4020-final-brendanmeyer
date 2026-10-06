// Opens the game WebSocket, keeps the reconnect token in localStorage (so
// a returning visitor resumes the same identity rather than claiming a
// fresh one), and exposes a tiny event-handler API to the rest of the
// client.

import type { ClientMessage, ServerMessage } from "../shared/protocol.js";

const TOKEN_KEY = "collective-snake-token";

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

export interface NetHandlers {
  onIdentity: (name: string) => void;
  onState: (state: Extract<ServerMessage, { t: "state" }>) => void;
}

export interface Net {
  sendInput: (x: number, y: number) => void;
}

export function connect(handlers: NetHandlers): Net {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${location.host}/ws`);

  socket.addEventListener("open", () => {
    const hello: ClientMessage = { t: "hello", token: getStoredToken() };
    socket.send(JSON.stringify(hello));
  });

  socket.addEventListener("message", (event) => {
    const msg: ServerMessage = JSON.parse(event.data);
    if (msg.t === "welcome") {
      storeToken(msg.token);
      handlers.onIdentity(msg.name);
    } else if (msg.t === "nameInvalid") {
      storeToken(msg.token);
      handlers.onIdentity(msg.assigned);
    } else if (msg.t === "state") {
      handlers.onState(msg);
    }
    // "nameTaken" doesn't apply here -- this client never asks for a
    // specific name, so it can't collide with one.
  });

  function sendInput(x: number, y: number): void {
    if (socket.readyState === WebSocket.OPEN) {
      const message: ClientMessage = { t: "input", x, y };
      socket.send(JSON.stringify(message));
    }
  }

  return { sendInput };
}
