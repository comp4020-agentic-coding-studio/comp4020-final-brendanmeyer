// The WebSocket handshake (claiming or resuming a pseudonym) and the
// connection registry the game loop reads to know who's actually
// connected and where their cursor currently is.

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../shared/protocol.ts";
import { claimName, findPlayerByToken } from "./db/repo.ts";
import { createColorState, release, reserve } from "./game/colors.ts";
import { hasCursor, nextRole, type Role } from "./game/roles.ts";
import type { Vec2 } from "./game/state.ts";

const colorState = createColorState();

export type { Role } from "./game/roles.ts";

export interface Connection {
  socket: WebSocket;
  playerId: number;
  name: string;
  token: string;
  lastInput: Vec2;
  role: Role;
  roleChangedAt: number;
  lastActivityAt: number;
  colorIndex: number | null;
}

export const connections = new Map<WebSocket, Connection>();

function findConnectionByPlayerId(playerId: number): Connection | undefined {
  for (const conn of connections.values()) {
    if (conn.playerId === playerId) return conn;
  }
  return undefined;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function markActivity(conn: Connection): void {
  conn.lastActivityAt = Date.now();
}

// Applies planning.md section 5's two timing rules to every live
// connection: no activity for 3 seconds starts the leaving flash; the
// flash lasts 2 seconds before full removal. Called once per tick from
// loop.ts, ahead of the simulation step, so a just-disconnected player
// stops contributing to the centroid/multiplier the same tick it's
// noticed.
export function sweep(now: number): void {
  for (const conn of [...connections.values()]) {
    const decision = nextRole(conn.role, conn.roleChangedAt, conn.lastActivityAt, now);
    if (decision === "removed") {
      connections.delete(conn.socket);
      release(colorState, conn.playerId);
      if (conn.socket.readyState === conn.socket.OPEN) conn.socket.close();
    } else if (decision !== null) {
      conn.role = decision;
      conn.roleChangedAt = now;
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function handleHello(socket: WebSocket, msg: Extract<ClientMessage, { t: "hello" }>): void {
  if (msg.token) {
    const existing = findPlayerByToken(msg.token);
    if (existing) {
      const live = findConnectionByPlayerId(existing.id);
      if (live && !msg.takeover) {
        send(socket, {
          t: "alreadyConnected",
          token: existing.token,
          playerId: existing.id,
          name: existing.name,
        });
        return;
      }
      // A confirmed takeover carries the same identity's colour straight
      // over rather than releasing and re-reserving it -- nothing about
      // the identity changed, just which socket represents it.
      const colorIndex = live ? live.colorIndex : reserve(colorState, existing.id, msg.color);

      if (live) {
        // Deleted before close() so a tick landing between the two never
        // finds both connections live for the same playerId.
        connections.delete(live.socket);
        live.socket.close();
      }

      connections.set(socket, {
        socket,
        playerId: existing.id,
        name: existing.name,
        token: existing.token,
        lastInput: { x: 0.5, y: 0.5 },
        role: "active",
        roleChangedAt: Date.now(),
        lastActivityAt: Date.now(),
        colorIndex,
      });
      send(socket, {
        t: "welcome",
        token: existing.token,
        playerId: existing.id,
        name: existing.name,
        // null only if every one of the 16 colours is somehow already
        // reserved, which can't happen at the 12-active-player cap.
        color: colorIndex ?? 0,
      });
      return;
    }
  }

  const result = claimName(msg.name);
  if (!result.ok) {
    send(socket, { t: "nameTaken" });
    return;
  }

  // null only if every one of the 16 colours is somehow already reserved,
  // which can't happen at the 12-active-player cap.
  const colorIndex = reserve(colorState, result.player.id, msg.color) ?? 0;

  connections.set(socket, {
    socket,
    playerId: result.player.id,
    name: result.player.name,
    token: result.player.token,
    lastInput: { x: 0.5, y: 0.5 },
    role: "active",
    roleChangedAt: Date.now(),
    lastActivityAt: Date.now(),
    colorIndex,
  });

  if (result.assignedName) {
    send(socket, {
      t: "nameInvalid",
      assigned: result.assignedName,
      token: result.player.token,
      playerId: result.player.id,
      color: colorIndex,
    });
    return;
  }

  send(socket, {
    t: "welcome",
    token: result.player.token,
    playerId: result.player.id,
    name: result.player.name,
    color: colorIndex,
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
    return;
  }
  if (msg.t === "input") {
    const conn = connections.get(socket);
    if (conn) {
      conn.lastInput = { x: clamp01(msg.x), y: clamp01(msg.y) };
      markActivity(conn);
    }
  }
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
    // A pong keeps a genuinely idle-but-connected player (not moving their
    // cursor) from ever going stale -- only a connection that stops
    // answering pings at all can time out.
    const heartbeat = setInterval(() => {
      if (socket.readyState === socket.OPEN) socket.ping();
    }, 1000);

    socket.on("pong", () => {
      const conn = connections.get(socket);
      if (conn) markActivity(conn);
    });

    socket.on("message", (data) => handleMessage(socket, data.toString()));

    socket.on("close", () => {
      clearInterval(heartbeat);
      const conn = connections.get(socket);
      if (!conn) return; // already removed (e.g. a confirmed takeover's delete-before-close)
      if (hasCursor(conn.role)) {
        conn.role = "leaving";
        conn.roleChangedAt = Date.now();
      } else {
        connections.delete(socket);
      }
    });
  });
}
