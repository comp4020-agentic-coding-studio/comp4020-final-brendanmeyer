import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

// planning.md section 6: a 13th visitor, beyond the 12-active-player cap,
// becomes a spectator rather than an active player -- no cursor rendered,
// doesn't influence the centroid or multiplier, but still receives state.
const baseUrl = inject("baseUrl");

function wsUrl(path: string): string {
  return new URL(path, baseUrl).toString().replace(/^http/, "ws");
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl("/ws"));
    socket.once("open", () => {
      const hello: ClientMessage = { t: "hello", name: "" };
      socket.send(JSON.stringify(hello));
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString())));
    socket.once("error", reject);
  });
}

type StateMessage = Extract<ServerMessage, { t: "state" }>;

function nextStateWhere(socket: WebSocket, predicate: (s: StateMessage) => boolean, timeoutMs: number): Promise<StateMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("predicate never matched in time")), timeoutMs);
    const onMessage = (data: Buffer): void => {
      const msg = JSON.parse(data.toString());
      if (msg.t === "state" && predicate(msg)) {
        clearTimeout(timeout);
        socket.off("message", onMessage);
        resolve(msg);
      }
    };
    socket.on("message", onMessage);
  });
}

function playerId(msg: ServerMessage): number {
  if (msg.t !== "welcome" && msg.t !== "nameInvalid") throw new Error("unreachable");
  return msg.playerId;
}

it(
  "a 13th visitor becomes a spectator rather than an active player",
  async () => {
    const twelve = await Promise.all(
      Array.from({ length: 12 }, async () => {
        const socket = await connect();
        await nextMessage(socket);
        return socket;
      }),
    );

    // Tolerates either immediate activation or resuming a run an earlier
    // test file left paused (same reasoning as spec/two-players.test.ts).
    await nextStateWhere(twelve[0], (s) => s.status === "running" && s.activeCount === 12, 10000);

    const thirteenth = await connect();
    const welcome13 = await nextMessage(thirteenth);
    const id13 = playerId(welcome13);

    const spectatorView = await nextStateWhere(thirteenth, (s) => s.you.role === "spectator", 2000);
    expect(spectatorView.you).toEqual({ role: "spectator" });
    expect(spectatorView.players.some((p) => p.id === id13)).toBe(false);

    // Still receives state, just not as a player -- the socket is alive
    // and the server keeps talking to it.
    const stillConnected = await nextStateWhere(thirteenth, () => true, 1000);
    expect(stillConnected.activeCount).toBe(12); // the spectator never counted

    for (const socket of twelve) socket.close();
    thirteenth.close();
  },
  20000,
);
