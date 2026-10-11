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

// An auto-generated pseudonym (empty name), not a fixed literal one -- a
// fixed name collides with the players table's name_lower uniqueness on any
// second run against the same long-lived dev server, which a hardcoded name
// here hit directly.
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

it(
  "a clean close starts the leaving flash immediately, then removes the player",
  async () => {
    const a = await connect();
    const welcomeA = await nextMessage(a);
    if (welcomeA.t !== "welcome" && welcomeA.t !== "nameInvalid") throw new Error("unreachable");
    const aId = welcomeA.playerId;

    const b = await connect();
    await nextMessage(b); // welcome/nameInvalid
    // Generous timeout: tolerates resuming a run an earlier test file left
    // paused (planning.md section 7's 5s countdown), same reasoning as
    // spec/join-intro.test.ts's setup.
    await nextStateWhere(b, (s) => s.activeCount === 2, 8000);

    const t0 = Date.now();
    a.close();

    const leaving = await nextStateWhere(b, (s) => findPlayer(s, aId)?.state === "leaving", 1500);
    expect(Date.now() - t0).toBeLessThan(500); // nowhere near the 3s silent-drop timeout
    expect(leaving.activeCount).toBe(1); // stopped counting immediately, not after the flash

    const removed = await nextStateWhere(b, (s) => findPlayer(s, aId) === undefined, 3000);
    expect(findPlayer(removed, aId)).toBeUndefined();

    // a's disconnect drops the game below 2 active players while it was
    // running, which pauses it (planning.md section 5) rather than ending
    // it. Left as-is for whichever test runs next -- see
    // spec/join-intro.test.ts's closing comment for why every WS test that
    // reaches "running" tolerates a possible inherited resume countdown in
    // its own setup, rather than each one trying to leave a clean slate.
    b.close();
  },
  15000,
);
