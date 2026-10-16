import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// planning.md section 13: up to `activePlayers` food items, weighted
// toward fewer. The exact count is genuinely random against a real
// server (spec/food.test.ts covers pickFoodCount's weighting with a
// forced rng), so this only checks the live invariant that holds no
// matter which count got rolled: food is always an array, never exceeds
// the active player count, and every item is a valid board position.
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

it(
  "food is always an array within [0, activeCount], at valid board positions",
  async () => {
    await settleSharedState();

    const a = await connect();
    const b = await connect();
    const running = await nextStateWhere(a, (s) => s.status === "running" && s.activeCount === 2, 8000);

    expect(Array.isArray(running.food)).toBe(true);
    expect(running.food.length).toBeLessThanOrEqual(running.activeCount);
    for (const item of running.food) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.x).toBeLessThanOrEqual(1);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeLessThanOrEqual(1);
    }

    a.close();
    b.close();
  },
  15000,
);
