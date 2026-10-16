import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// planning.md section 10/11: the server already computes the centroid to
// steer the snake, but never put it on the wire -- a client can't offer
// easy/hard mode (section 11's local display toggle) without it. This only
// checks the server side: that StateMessage carries the real centroid,
// matching src/server/game/centroid.ts's own plain mean. The client-side
// toggle (local display only, never reaches the server) has no dedicated
// spec, the same as the existing ghost-trail "G" toggle.
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

function send(socket: WebSocket, message: ClientMessage): void {
  socket.send(JSON.stringify(message));
}

it(
  "carries the real centroid of active players' cursor positions",
  async () => {
    await settleSharedState();

    const a = await connect();
    const b = await connect();
    await nextStateWhere(a, (s) => s.status === "running" && s.activeCount === 2, 8000);

    send(a, { t: "input", x: 0.2, y: 0.2 });
    send(b, { t: "input", x: 0.8, y: 0.8 });

    const state = await nextStateWhere(
      a,
      (s) => s.centroid !== null && Math.abs(s.centroid.x - 0.5) < 0.01 && Math.abs(s.centroid.y - 0.5) < 0.01,
      3000,
    );
    expect(state.centroid).not.toBeNull();
    expect(state.centroid?.x).toBeCloseTo(0.5, 1);
    expect(state.centroid?.y).toBeCloseTo(0.5, 1);

    a.close();
    b.close();
  },
  15000,
);

it(
  "is null when there's no active player to average",
  async () => {
    const solo = await connect();
    const state = await nextStateWhere(solo, (s) => s.status === "waiting", 3000);
    expect(state.centroid).toBeNull();
    solo.close();
  },
  15000,
);
