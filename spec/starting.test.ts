import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// The second session to join a fresh (never-started) game is the one whose
// arrival is what actually starts the run -- rather than jumping straight
// from "waiting alone" to "running," it gets a brief "starting" moment
// first, visible to both sessions, before the game actually begins
// simulating. Distinct from planning.md section 4's "introducing" (joining
// a game already running) and section 7's "resuming" (restoring a paused
// run) -- neither applies to a run's very first start.
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

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString())));
    socket.once("error", reject);
  });
}

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
  "the second player to join a fresh game starts rather than jumping straight to active",
  async () => {
    await settleSharedState();

    const a = await connect();
    const firstState = await nextMessage(a);
    // Tolerates resuming an earlier test file's paused run the same way
    // spec/two-players.test.ts does -- this spec only cares about the
    // fresh-game path, so skip ahead if there's already a run in progress.
    if (firstState.t === "state" && firstState.status !== "waiting") {
      a.close();
      return;
    }

    const b = await connect();
    const welcomeB = await nextMessage(b);
    const bId = playerId(welcomeB);

    const starting = await nextStateWhere(a, (s) => findPlayer(s, bId)?.state === "starting", 2000);
    expect(starting.status).toBe("waiting"); // not running yet -- still starting
    expect(findPlayer(starting, bId)?.state).toBe("starting");

    const running = await nextStateWhere(a, (s) => s.status === "running", 5000);
    expect(running.activeCount).toBe(2);
    expect(findPlayer(running, bId)?.state).toBe("active");

    a.close();
    b.close();
  },
  15000,
);
