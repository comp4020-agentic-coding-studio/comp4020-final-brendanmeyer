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

// The very next message isn't necessarily a state broadcast -- a's own
// welcome arrives first -- so this skips past anything else to find one,
// the same distinction spec/two-players.test.ts's nextState already makes.
function nextState(socket: WebSocket): Promise<StateMessage> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: Buffer): void => {
      const msg = JSON.parse(data.toString());
      if (msg.t === "state") {
        socket.off("message", onMessage);
        resolve(msg);
      }
    };
    socket.on("message", onMessage);
    socket.once("error", reject);
  });
}

// Attaches a persistent listener immediately (rather than attaching one
// only after some earlier await), so no `state` broadcast is lost to the
// gap between a prior `.once("message", ...)` resolving and a later
// `.on("message", ...)` being attached -- a real risk here, since the
// "starting" role (and its broadcasts) exists for a short, fixed window
// starting the instant the second connection is registered, which can be
// before any listener this test attaches after that point.
function watchStates(socket: WebSocket, predicate: (s: StateMessage) => boolean, timeoutMs: number): Promise<StateMessage> {
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
    await nextMessage(a); // a's own welcome -- not a state broadcast, discarded
    const firstState = await nextState(a);
    // This spec only cares about the fresh-game path -- a paused run left
    // by an earlier test file resumes instead of starting (pausedWithRun
    // stays true with status still "waiting", so checking status alone
    // isn't enough to tell the two apart).
    if (firstState.pausedWithRun) {
      a.close();
      return;
    }

    // Attached before b even connects, so the very first broadcast
    // carrying b's "starting" role (which can arrive within one tick of
    // the hello being processed) is never missed.
    let bId = -1;
    const starting = watchStates(a, (s) => bId !== -1 && findPlayer(s, bId)?.state === "starting", 4000);
    const running = watchStates(a, (s) => s.status === "running", 8000);

    const b = await connect();
    const welcomeB = await nextMessage(b);
    bId = playerId(welcomeB);

    const startingState = await starting;
    expect(startingState.status).toBe("waiting"); // not running yet -- still starting
    expect(findPlayer(startingState, bId)?.state).toBe("starting");

    const runningState = await running;
    expect(runningState.activeCount).toBe(2);
    expect(findPlayer(runningState, bId)?.state).toBe("active");

    a.close();
    b.close();
  },
  15000,
);
