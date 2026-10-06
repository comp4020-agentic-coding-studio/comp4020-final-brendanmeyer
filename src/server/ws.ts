// The WebSocket handshake: claiming or resuming a pseudonym. The game loop
// (not built yet) reads `connections` to know who's actually connected;
// this module's job stops at identity.

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../shared/protocol.ts";
import { claimName, findPlayerByToken } from "./db/repo.ts";

export interface Connection {
  socket: WebSocket;
  playerId: number;
  name: string;
  token: string;
}

export const connections = new Map<WebSocket, Connection>();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function handleHello(socket: WebSocket, msg: Extract<ClientMessage, { t: "hello" }>): void {
  if (msg.token) {
    const existing = findPlayerByToken(msg.token);
    if (existing) {
      connections.set(socket, {
        socket,
        playerId: existing.id,
        name: existing.name,
        token: existing.token,
      });
      send(socket, {
        t: "welcome",
        token: existing.token,
        playerId: existing.id,
        name: existing.name,
      });
      return;
    }
  }

  const result = claimName(msg.name);
  if (!result.ok) {
    send(socket, { t: "nameTaken" });
    return;
  }

  connections.set(socket, {
    socket,
    playerId: result.player.id,
    name: result.player.name,
    token: result.player.token,
  });

  if (result.assignedName) {
    send(socket, {
      t: "nameInvalid",
      assigned: result.assignedName,
      token: result.player.token,
      playerId: result.player.id,
    });
    return;
  }

  send(socket, {
    t: "welcome",
    token: result.player.token,
    playerId: result.player.id,
    name: result.player.name,
  });
}

function handleMessage(socket: WebSocket, raw: string): void {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.t === "hello") {
    handleHello(socket, msg);
  }
  // "input" messages are for the game loop, not built yet.
}

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(req.url ?? "/", "http://internal");
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket: WebSocket) => {
    socket.on("message", (data) => handleMessage(socket, data.toString()));
    socket.on("close", () => connections.delete(socket));
  });
}
