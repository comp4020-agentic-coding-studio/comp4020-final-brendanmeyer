// The WebSocket handshake (claiming or resuming a pseudonym) and the
// connection registry the game loop reads to know who's actually
// connected and where their cursor currently is.

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../shared/protocol.ts";
import { claimName, findExistingPlayer, renameName, setPasswordIfNone } from "./db/repo.ts";
import { createColorState, release, reserve } from "./game/colors.ts";
import { MAX_ACTIVE, hasCursor, nextRole, occupiesSlot, type Role } from "./game/roles.ts";
import { accept, createQueueState, dropOffer, enqueue, expireIfNeeded, makeOfferIfNeeded } from "./game/queue.ts";
import { activateRole, admit } from "./game/roster.ts";
import { getState, type Vec2 } from "./game/state.ts";
import { logEvent } from "./log.ts";

const colorState = createColorState();
const queueState = createQueueState();

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

function occupiedSlotCount(): number {
  let count = 0;
  for (const conn of connections.values()) {
    if (occupiesSlot(conn.role)) count++;
  }
  return count;
}

// This connection's position in the FIFO queue (1-indexed) and the
// queue's current size -- null if it isn't actually waiting (e.g. it
// already holds the offer). Read by loop.ts to build StateMessage.you.
export function queuePositionOf(playerId: number): { position: number; size: number } | null {
  const index = queueState.waiting.findIndex((entry) => entry.playerId === playerId);
  if (index === -1) return null;
  return { position: index + 1, size: queueState.waiting.length };
}

// Milliseconds left on this connection's claim window -- null if it
// doesn't currently hold the offer.
export function offerRemainingMs(playerId: number, now: number): number | null {
  if (!queueState.offer || queueState.offer.entry.playerId !== playerId) return null;
  return Math.max(0, queueState.offer.expiresAt - now);
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
// flash lasts 2 seconds before full removal. Then the queue (section 7):
// an unanswered offer expires back to spectator, and a freed slot with no
// outstanding offer gets offered to whoever's waited longest. Called once
// per tick from loop.ts, ahead of the simulation step, so a
// just-disconnected player stops contributing to the centroid/multiplier
// the same tick it's noticed.
export function sweep(now: number): void {
  for (const conn of [...connections.values()]) {
    const decision = nextRole(conn.role, conn.roleChangedAt, conn.lastActivityAt, now);
    if (decision === "removed") {
      // The disconnect itself was already logged when this connection
      // entered "leaving" (either here, via timeout below, or in the
      // socket's own "close" handler for a clean disconnect) -- this is
      // just that flash window finishing, not a second disconnect.
      connections.delete(conn.socket);
      release(colorState, conn.playerId);
      if (conn.socket.readyState === conn.socket.OPEN) conn.socket.close();
      logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: conn.role, to: "removed" });
    } else if (decision !== null) {
      // nextRole only ever returns "leaving" for a silent timeout -- a
      // clean close is handled directly in the "close" event below, never
      // through this path.
      if (decision === "leaving") {
        logEvent("player_disconnected", conn.playerId, { playerId: conn.playerId, name: conn.name, reason: "timeout" });
      }
      logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: conn.role, to: decision });
      conn.role = decision;
      conn.roleChangedAt = now;
    }
  }

  const expired = expireIfNeeded(queueState, now);
  if (expired) {
    const conn = findConnectionByPlayerId(expired.playerId);
    if (conn) {
      logEvent("queue_offer_declined", conn.playerId, { playerId: conn.playerId, name: conn.name, reason: "expired" });
      logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: "offered", to: "spectator" });
      conn.role = "spectator";
      conn.roleChangedAt = now;
    }
  }

  if (occupiedSlotCount() < MAX_ACTIVE) {
    const offered = makeOfferIfNeeded(queueState, now);
    if (offered) {
      const conn = findConnectionByPlayerId(offered.playerId);
      if (conn) {
        logEvent("queue_offer_made", conn.playerId, { playerId: conn.playerId, name: conn.name });
        logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: conn.role, to: "offered" });
        conn.role = "offered";
        conn.roleChangedAt = now;
      }
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function handleHello(socket: WebSocket, msg: Extract<ClientMessage, { t: "hello" }>): void {
  // A live token wins outright; failing that, a validly-formed,
  // already-claimed name with a matching password retrieves it from a
  // device that doesn't hold its token (planning.md's password retrieval --
  // a second way to prove the same identity, not a second identity).
  const existing = findExistingPlayer(msg.token, msg.name, msg.password ?? "");
  if (existing) {
    const live = findConnectionByPlayerId(existing.id);
    if (live && !msg.takeover) {
      logEvent("player_duplicate_detected", existing.id, { playerId: existing.id, name: existing.name });
      send(socket, {
        t: "alreadyConnected",
        token: existing.token,
        playerId: existing.id,
        name: existing.name,
      });
      return;
    }
    // A chosen name replaces a generated pseudonym (or an earlier choice)
    // on resume -- only when it's actually different, so re-submitting
    // the name already in effect (the common case now the entry screen
    // pre-fills it) doesn't hit the database every reconnect. An invalid
    // or already-taken request just keeps the existing name rather than
    // failing the connection over it.
    const requestedName = msg.name?.trim();
    let name = existing.name;
    if (requestedName && requestedName.toLowerCase() !== existing.name.toLowerCase()) {
      const renamed = renameName(existing.id, requestedName);
      if (renamed.ok) {
        logEvent("player_renamed", existing.id, { playerId: existing.id, from: name, to: renamed.name });
        name = renamed.name;
      }
    }

    // A confirmed takeover carries the same identity's colour -- and
    // stays fully active -- straight over rather than treating it as a
    // fresh join; nothing about the identity changed, just which socket
    // represents it. A genuine resume (no live connection to take over
    // from) goes through the same capacity/join-role decision as a fresh
    // claim.
    const role: Role = live ? "active" : admit(occupiedSlotCount(), getState().status, getState().pausedWithRun);
    // Spectators don't reserve a colour (planning.md section 2).
    const colorIndex = live ? live.colorIndex : role === "spectator" ? null : reserve(colorState, existing.id, msg.color);

    if (live) {
      // Deleted before close() so a tick landing between the two never
      // finds both connections live for the same playerId.
      connections.delete(live.socket);
      live.socket.close();
      logEvent("player_takeover", existing.id, { playerId: existing.id, name });
      logEvent("role_changed", existing.id, { playerId: existing.id, name, from: live.role, to: role });
    } else {
      // The hello resolved to this identity either by the token it
      // carried (a genuine reconnect) or by a validly-formed name plus a
      // matching password (planning.md's cross-device retrieval) -- worth
      // telling apart in the log since they're different stories about
      // the same visitor.
      const mode = msg.token && existing.token === msg.token ? "resumed" : "retrieved";
      logEvent("player_connected", existing.id, { playerId: existing.id, name, mode });
      logEvent("role_changed", existing.id, { playerId: existing.id, name, from: null, to: role });
    }

    connections.set(socket, {
      socket,
      playerId: existing.id,
      name,
      token: existing.token,
      lastInput: { x: 0.5, y: 0.5 },
      role,
      roleChangedAt: Date.now(),
      lastActivityAt: Date.now(),
      colorIndex,
    });
    send(socket, {
      t: "welcome",
      token: existing.token,
      playerId: existing.id,
      name,
      // null only if every one of the 16 colours is somehow already
      // reserved, which can't happen at the 12-active-player cap.
      color: colorIndex ?? 0,
      hasPassword: existing.hasPassword,
    });
    return;
  }

  const result = claimName(msg.name, msg.password ?? "");
  if (!result.ok) {
    send(socket, { t: "nameTaken" });
    return;
  }

  const role = admit(occupiedSlotCount(), getState().status, getState().pausedWithRun);
  // Spectators don't reserve a colour (planning.md section 2); otherwise
  // null only if every one of the 16 colours is somehow already reserved,
  // which can't happen at the 12-active-player cap.
  const colorIndex = role === "spectator" ? null : (reserve(colorState, result.player.id, msg.color) ?? 0);

  logEvent("player_connected", result.player.id, { playerId: result.player.id, name: result.player.name, mode: "claimed" });
  logEvent("role_changed", result.player.id, { playerId: result.player.id, name: result.player.name, from: null, to: role });

  connections.set(socket, {
    socket,
    playerId: result.player.id,
    name: result.player.name,
    token: result.player.token,
    lastInput: { x: 0.5, y: 0.5 },
    role,
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
      color: colorIndex ?? 0,
    });
    return;
  }

  send(socket, {
    t: "welcome",
    token: result.player.token,
    playerId: result.player.id,
    name: result.player.name,
    color: colorIndex ?? 0,
    hasPassword: result.player.hasPassword,
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
    return;
  }

  // Opt-in (planning.md section 7): only a spectator who explicitly asks
  // joins the FIFO queue. The same action re-enters after a dropped offer,
  // landing at the back since it's a fresh enqueue, not a resume of the
  // old position.
  if (msg.t === "requestJoin") {
    const conn = connections.get(socket);
    if (conn && conn.role === "spectator") {
      conn.role = "queued";
      conn.roleChangedAt = Date.now();
      enqueue(queueState, { playerId: conn.playerId });
      const position = queuePositionOf(conn.playerId);
      logEvent("queue_joined", conn.playerId, { playerId: conn.playerId, name: conn.name, position: position?.position ?? null });
      logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: "spectator", to: "queued" });
    }
    return;
  }

  if (msg.t === "acceptOffer") {
    const conn = connections.get(socket);
    if (conn && conn.role === "offered") {
      const accepted = accept(queueState, conn.playerId);
      if (accepted) {
        // Same join-role decision as any other join (spec/join-intro.test.ts):
        // the game being "running" still means an introduction, not an
        // instant jump into active play.
        const from = conn.role;
        conn.role = activateRole(getState().status, getState().pausedWithRun, occupiedSlotCount());
        conn.roleChangedAt = Date.now();
        conn.colorIndex = reserve(colorState, conn.playerId, undefined);
        logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from, to: conn.role });
      }
    }
    return;
  }

  if (msg.t === "declineOffer") {
    const conn = connections.get(socket);
    if (conn && conn.role === "offered") {
      const dropped = dropOffer(queueState);
      if (dropped) {
        conn.role = "spectator";
        conn.roleChangedAt = Date.now();
        logEvent("queue_offer_declined", conn.playerId, { playerId: conn.playerId, name: conn.name, reason: "declined" });
        logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: "offered", to: "spectator" });
      }
    }
    return;
  }

  if (msg.t === "setPassword") {
    const conn = connections.get(socket);
    if (!conn) return;
    const result = setPasswordIfNone(conn.playerId, msg.password);
    if (result.ok) {
      logEvent("password_set", conn.playerId, { playerId: conn.playerId, name: conn.name });
    }
    send(socket, result.ok ? { t: "passwordSet", ok: true } : { t: "passwordSet", ok: false, reason: result.reason });
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
        logEvent("player_disconnected", conn.playerId, { playerId: conn.playerId, name: conn.name, reason: "closed" });
        logEvent("role_changed", conn.playerId, { playerId: conn.playerId, name: conn.name, from: conn.role, to: "leaving" });
        conn.role = "leaving";
        conn.roleChangedAt = Date.now();
      } else {
        // A spectator/queued/offered connection has no cursor and so no
        // leaving flash to animate -- it's removed outright, but the
        // disconnect itself is still worth a line in the log.
        logEvent("player_disconnected", conn.playerId, { playerId: conn.playerId, name: conn.name, reason: "closed" });
        connections.delete(socket);
      }
    });
  });
}
