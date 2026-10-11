import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

// planning.md section 4: a player joining a game already running gets a
// 2-second introduction -- their cursor is visible but doesn't affect the
// centroid or the multiplier until it completes. The setup below tolerates
// either a brand-new game (spec/two-players.test.ts covers that path
// directly) or resuming one an earlier test file left paused
// (planning.md section 7) -- either way two sessions reach active.
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

function findPlayer(msg: StateMessage, playerId: number) {
  return msg.players.find((p) => p.id === playerId);
}

function playerId(msg: ServerMessage): number {
  if (msg.t !== "welcome" && msg.t !== "nameInvalid") throw new Error("unreachable");
  return msg.playerId;
}

it(
  "a player joining a running game is introduced for 2s before affecting the centroid or multiplier",
  async () => {
    const a = await connect();
    await nextMessage(a);
    const b = await connect();
    await nextMessage(b);
    // Generous timeout: normally two fresh sessions -> running immediately
    // (spec/two-players.test.ts), but if an earlier test file left the
    // shared game paused (planning.md section 7), these two instead resume
    // it via the 5s countdown. Either way it reaches running with 2 active.
    await nextStateWhere(a, (s) => s.status === "running" && s.activeCount === 2, 8000);

    const c = await connect();
    const welcomeC = await nextMessage(c);
    const cId = playerId(welcomeC);

    const introducing = await nextStateWhere(a, (s) => findPlayer(s, cId)?.state === "introducing", 1000);
    expect(introducing.activeCount).toBe(2); // c doesn't count yet
    expect(introducing.multiplier).toBeCloseTo(1.0, 5); // still a 2-player multiplier

    const activated = await nextStateWhere(a, (s) => findPlayer(s, cId)?.state === "active", 3000);
    expect(activated.activeCount).toBe(3); // now counts

    // Closing all three drops the game below 2 active players while it was
    // running, which pauses it (planning.md section 5) rather than ending
    // it. Left as-is for whichever test runs next -- that's why every WS
    // test file that reaches "running" tolerates a possible resume
    // countdown in its own setup, rather than each one trying to leave a
    // clean slate behind (which just moves the same pause to whichever
    // test runs after it).
    a.close();
    b.close();
    c.close();
  },
  15000,
);
