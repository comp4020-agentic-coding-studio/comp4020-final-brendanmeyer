import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

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

it("assigns the requested colour, or a different one if it's already taken", async () => {
  const a = await connect(2);
  const welcomeA = await nextMessage(a);
  expect(colorOf(welcomeA)).toBe(2);

  const b = await connect(2); // same colour, already reserved by a
  const welcomeB = await nextMessage(b);
  expect(colorOf(welcomeB)).not.toBe(2);

  a.close();
  b.close();
});

it(
  "releases a colour once the player is fully removed, not just leaving",
  async () => {
    const a = await connect(5);
    await nextMessage(a);
    a.close();

    // Still within the 2s leaving flash: the colour must not be reusable yet.
    const bEarly = await connect(5);
    const welcomeBEarly = await nextMessage(bEarly);
    expect(colorOf(welcomeBEarly)).not.toBe(5);
    bEarly.close();

    // Past the flash: a is fully removed, so 5 is free again.
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const bLate = await connect(5);
    const welcomeBLate = await nextMessage(bLate);
    expect(colorOf(welcomeBLate)).toBe(5);
    bLate.close();
  },
  8000,
);
