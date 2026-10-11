import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// planning.md section 7: a spectator opts into the queue (requestJoin), and
// when a slot opens gets offered it with a 5s claim window. Accepting
// activates them through the same join-role decision as any other join
// (spec/join-intro.test.ts); declining or letting the offer expire drops
// the entry, which only re-enters via a fresh requestJoin.
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

function playerId(msg: ServerMessage): number {
  if (msg.t !== "welcome" && msg.t !== "nameInvalid") throw new Error("unreachable");
  return msg.playerId;
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

function findPlayer(msg: StateMessage, id: number) {
  return msg.players.find((p) => p.id === id);
}

async function fillToCapacity(): Promise<WebSocket[]> {
  const sockets = await Promise.all(
    Array.from({ length: 12 }, async () => {
      const socket = await connect();
      await nextMessage(socket);
      return socket;
    }),
  );
  await nextStateWhere(sockets[0], (s) => s.status === "running" && s.activeCount === 12, 10000);
  return sockets;
}

it(
  "a spectator who requests to join gets offered a freed slot and can accept it",
  async () => {
    await settleSharedState();
    const twelve = await fillToCapacity();

    const spectator = await connect();
    const welcomeSpec = await nextMessage(spectator);
    const specId = playerId(welcomeSpec);
    await nextStateWhere(spectator, (s) => s.you.role === "spectator", 2000);

    send(spectator, { t: "requestJoin" });
    const queued = await nextStateWhere(spectator, (s) => s.you.role === "queued", 1000);
    expect(queued.you).toEqual({ role: "queued", position: 1, size: 1 });

    // Free a slot: close one of the twelve and wait out its leaving flash
    // (it still occupies a slot until fully removed).
    twelve[0].close();

    const offered = await nextStateWhere(spectator, (s) => s.you.role === "offered", 5000);
    expect(offered.you.role).toBe("offered");
    if (offered.you.role === "offered") expect(offered.you.remainingMs).toBeGreaterThan(0);

    send(spectator, { t: "acceptOffer" });
    const accepted = await nextStateWhere(spectator, (s) => findPlayer(s, specId)?.state === "introducing", 2000);
    expect(findPlayer(accepted, specId)).toBeDefined();

    for (const socket of twelve.slice(1)) socket.close();
    spectator.close();
  },
  32000,
);

it(
  "an unanswered offer expires and passes to the next queued spectator; the original must re-request",
  async () => {
    await settleSharedState();
    const twelve = await fillToCapacity();

    const first = await connect();
    const welcomeFirst = await nextMessage(first);
    const firstId = playerId(welcomeFirst);
    await nextStateWhere(first, (s) => s.you.role === "spectator", 2000);

    const second = await connect();
    await nextMessage(second);
    await nextStateWhere(second, (s) => s.you.role === "spectator", 2000);

    send(first, { t: "requestJoin" });
    await nextStateWhere(first, (s) => s.you.role === "queued", 1000);
    send(second, { t: "requestJoin" });
    const secondQueued = await nextStateWhere(second, (s) => s.you.role === "queued", 1000);
    expect(secondQueued.you).toEqual({ role: "queued", position: 2, size: 2 });

    twelve[0].close();
    await nextStateWhere(first, (s) => s.you.role === "offered", 5000);

    // Don't answer -- let the whole claim window elapse.
    const firstDropped = await nextStateWhere(first, (s) => s.you.role === "spectator", 6000);
    expect(firstDropped.you).toEqual({ role: "spectator" });

    const secondOffered = await nextStateWhere(second, (s) => s.you.role === "offered", 2000);
    expect(secondOffered.you.role).toBe("offered");

    // The original isn't requeued automatically -- it has to ask again,
    // landing at the back (empty queue now, since second was offered, not
    // waiting).
    send(first, { t: "requestJoin" });
    const firstRequeued = await nextStateWhere(first, (s) => s.you.role === "queued", 1000);
    expect(firstRequeued.you).toEqual({ role: "queued", position: 1, size: 1 });

    for (const socket of twelve.slice(1)) socket.close();
    first.close();
    second.close();
  },
  37000,
);
