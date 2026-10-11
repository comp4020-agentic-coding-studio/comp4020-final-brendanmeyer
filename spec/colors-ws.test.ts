import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";
import { settleSharedState } from "./settle.ts";

// Phase 3 part B: the hello color round-trip and the release-on-removal
// timing, over a real socket. The reservation logic itself (lowest-free,
// honour-if-free, release-and-reuse) is pure-tested in spec/colors.test.ts.
const baseUrl = inject("baseUrl");

function wsUrl(path: string): string {
  return new URL(path, baseUrl).toString().replace(/^http/, "ws");
}

function connect(color?: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl("/ws"));
    socket.once("open", () => {
      const hello: ClientMessage = { t: "hello", name: "", color };
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

function colorOf(msg: ServerMessage): number {
  if (msg.t !== "welcome" && msg.t !== "nameInvalid") throw new Error("unreachable");
  return msg.color;
}

// High palette indices, deliberately: connections elsewhere in the suite
// that don't request a colour always get the lowest free one, so a test
// asserting an exact index stays clear of those by picking from the top
// instead of the bottom.
it("assigns the requested colour, or a different one if it's already taken", async () => {
  // A connection becomes a spectator (no colour at all) rather than active
  // if the 12-player cap is already saturated by a preceding test's
  // not-yet-cleared connections (planning.md section 5's 2s leaving
  // flash still occupies a slot) -- wait that out first.
  await settleSharedState();

  const a = await connect(15);
  const welcomeA = await nextMessage(a);
  expect(colorOf(welcomeA)).toBe(15);

  const b = await connect(15); // same colour, already reserved by a
  const welcomeB = await nextMessage(b);
  expect(colorOf(welcomeB)).not.toBe(15);

  a.close();
  b.close();
}, 12000);

it(
  "releases a colour once the player is fully removed, not just leaving",
  async () => {
    const a = await connect(14);
    await nextMessage(a);
    a.close();

    // Still within the 2s leaving flash: the colour must not be reusable yet.
    const bEarly = await connect(14);
    const welcomeBEarly = await nextMessage(bEarly);
    expect(colorOf(welcomeBEarly)).not.toBe(14);
    bEarly.close();

    // Past the flash: a is fully removed, so 14 is free again.
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const bLate = await connect(14);
    const welcomeBLate = await nextMessage(bLate);
    expect(colorOf(welcomeBLate)).toBe(14);
    bLate.close();
  },
  8000,
);
