import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

// A second tab in the same browser shares localStorage, so it resumes the
// same reconnect token. That must not silently become a second player
// steering as the first: the second connection is offered a takeover
// instead, and only replaces the first once it confirms.
const baseUrl = inject("baseUrl");

function wsUrl(path: string): string {
  return new URL(path, baseUrl).toString().replace(/^http/, "ws");
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl("/ws"));
    socket.once("open", () => resolve(socket));
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

function closed(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => socket.once("close", () => resolve()));
}

it("offers a takeover instead of doubling the same identity", async () => {
  const a = await connect();
  send(a, { t: "hello", name: "" });
  const welcome = await nextMessage(a);
  expect(welcome.t).toBe("nameInvalid"); // generated pseudonym, still carries a token
  if (welcome.t !== "nameInvalid") throw new Error("unreachable");
  const { token, playerId } = welcome;

  const b = await connect();
  send(b, { t: "hello", token });
  const offer = await nextMessage(b);
  expect(offer).toMatchObject({ t: "alreadyConnected", token, playerId });

  // a hasn't been touched yet -- still the live connection, not kicked.
  expect(a.readyState).toBe(WebSocket.OPEN);

  const aClosed = closed(a);
  send(b, { t: "hello", token, takeover: true });
  const takeoverWelcome = await nextMessage(b);
  expect(takeoverWelcome).toMatchObject({ t: "welcome", token, playerId });

  await aClosed; // confirming takes over by kicking the original connection

  a.close();
  b.close();
});
