import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

// The disconnect-timeout threshold itself (planning.md section 5: 3s of
// silence starts the leaving flash, which lasts 2s before removal) is pure
// timing logic, tested without real elapsed time in spec/roles.test.ts. This
// file covers the other half: a clean close is wired all the way through to
// that same leaving-then-removed behaviour over a real socket, and
// immediately -- not after waiting out the silence timeout. (A genuinely
// silent network drop isn't something a real localhost socket can reliably
// simulate: destroying a connection here still tends to deliver a close to
// the server almost at once, which is exactly why the timeout threshold
// itself needs the pure test instead.)
const baseUrl = inject("baseUrl");

function wsUrl(path: string): string {
  return new URL(path, baseUrl).toString().replace(/^http/, "ws");
}

function connect(name: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl("/ws"));
    socket.once("open", () => {
      const hello: ClientMessage = { t: "hello", name };
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

function findPlayer(msg: StateMessage, name: string) {
  return msg.players.find((p) => p.name === name);
}

it(
  "a clean close starts the leaving flash immediately, then removes the player",
  async () => {
    const a = await connect("discA");
    const b = await connect("discB");
    await nextStateWhere(b, (s) => s.activeCount === 2, 5000);

    const t0 = Date.now();
    a.close();

    const leaving = await nextStateWhere(b, (s) => findPlayer(s, "discA")?.state === "leaving", 1500);
    expect(Date.now() - t0).toBeLessThan(500); // nowhere near the 3s silent-drop timeout
    expect(leaving.activeCount).toBe(1); // stopped counting immediately, not after the flash

    const removed = await nextStateWhere(b, (s) => findPlayer(s, "discA") === undefined, 3000);
    expect(findPlayer(removed, "discA")).toBeUndefined();

    b.close();
  },
  10000,
);
