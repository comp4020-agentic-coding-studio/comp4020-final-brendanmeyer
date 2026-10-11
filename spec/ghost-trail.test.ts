import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// planning.md section 21: a record-setting run's samples get stored and
// are servable as a replay. Steering both players toward the same edge is
// a fast, deterministic way to force a real wall collision -- the snake
// starts at the board's centre and SNAKE_SPEED (0.01/tick) means reaching
// an edge takes only ~50 ticks (~3.3s at TICK_MS), far faster than waiting
// for one to happen incidentally.
//
// Generous timeouts throughout: this is the one spec file that reaches a
// real "gameover" at all, and observed local wall-clock jitter (not a
// logic bug -- it always passes in isolation, and only ever fails with
// "never matched in time," never with the wrong value) occasionally eats
// into tighter budgets during a long, heavily-loaded local test session.
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

function send(socket: WebSocket, message: ClientMessage): void {
  socket.send(JSON.stringify(message));
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

interface RecordRunRow {
  runId: number;
  collectiveScore: number;
  rawScore: number;
  endedAt: number;
  peakPlayers: number;
}

it(
  "a record-setting run's replay is stored and servable in order",
  async () => {
    await settleSharedState();

    const a = await connect();
    await nextMessage(a);
    const b = await connect();
    await nextMessage(b);
    await nextStateWhere(a, (s) => s.status === "running" && s.activeCount === 2, 12000);

    // Steer hard toward the right edge -- one input each is enough, the
    // server keeps steering toward the last target every tick.
    send(a, { t: "input", x: 1, y: 0.5 });
    send(b, { t: "input", x: 1, y: 0.5 });

    const gameover = await nextStateWhere(a, (s) => s.status === "gameover", 10000);
    const finishedScore = gameover.collectiveScore;

    // The run just finished should be the highest (or tied-highest, but
    // most recent) record on the board -- find it by score, since the
    // gameover state itself doesn't carry a runId.
    const recordsRes = await fetch(new URL("/api/records", baseUrl));
    const records: RecordRunRow[] = await recordsRes.json();
    const match = records.find((r) => r.collectiveScore === finishedScore);
    expect(match).toBeDefined();

    const replayRes = await fetch(new URL(`/api/records/${match?.runId}/replay`, baseUrl));
    expect(replayRes.status).toBe(200);
    const replay: { elapsedMs: number }[] = await replayRes.json();
    expect(replay.length).toBeGreaterThan(0);
    for (let i = 1; i < replay.length; i++) {
      expect(replay[i].elapsedMs).toBeGreaterThanOrEqual(replay[i - 1].elapsedMs);
    }

    a.close();
    b.close();
  },
  40000,
);
