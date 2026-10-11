import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// The core invariant this week: the game needs 2 active players, no solo
// fallback. One session alone must see "waiting"; a second joining must
// flip it to "running" with both counted.
const baseUrl = inject("baseUrl");

function wsUrl(path: string): string {
  return new URL(path, baseUrl).toString().replace(/^http/, "ws");
}

// Joining requires the handshake (spec/pseudonym.test.ts) before a socket
// counts as an active player at all, so this sends an empty hello (an
// auto-generated pseudonym is fine here) right after opening.
function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl("/ws"));
    socket.once("open", () => {
      socket.send(JSON.stringify({ t: "hello" }));
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

function nextState(socket: WebSocket): Promise<ServerMessage & { t: "state" }> {
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

it(
  "waits alone, then runs once a second session joins",
  async () => {
    await settleSharedState();

    const a = await connect();
    const firstState = await nextState(a);
    expect(firstState.status).toBe("waiting");

    const b = await connect();

    // Generous timeout: if an earlier test file's game paused (dropped
    // below 2 active players while running) and never resumed, these two
    // fresh sessions resume that run instead of starting a new one --
    // planning.md section 7's 5s resume countdown, not the normal instant
    // activation. Either way the game reaches running with 2 active (see
    // spec/join-intro.test.ts's setup for the same tolerance, and its
    // closing comment for why no WS test tries to leave a clean slate
    // behind instead).
    const running = await new Promise<ServerMessage & { t: "state" }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("never reached running")), 8000);
      a.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.t === "state" && msg.status === "running") {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });
    expect(running.activeCount).toBe(2);

    a.close();
    b.close();
  },
  13000,
);
