import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

// A name's password protects retrieval from a device that doesn't already
// hold its reconnect token -- not a second identity concept, just a second
// way to prove the same one. A blank password at claim time means that
// name is retrievable by anyone who just knows it, no password required.
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

// See spec/pseudonym.test.ts's uniqueName comment -- a fixed literal name
// permanently claims that row against the same long-lived local dev server.
function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

// The original device is still connected, so retrieval goes through the
// same confirm-before-kick flow as the existing duplicate-token handling
// (decisions/0001's Case 1), rather than silently booting it.
it("retrieves a password-protected name from a fresh connection with the right password", async () => {
  const name = uniqueName("pwowner");
  const a = await connect();
  send(a, { t: "hello", name, password: "secret123" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");

  const b = await connect();
  send(b, { t: "hello", name, password: "secret123" });
  const offer = await nextMessage(b);
  expect(offer).toMatchObject({ t: "alreadyConnected", playerId: welcomeA.playerId });

  send(b, { t: "hello", name, password: "secret123", takeover: true });
  const welcomeB = await nextMessage(b);
  expect(welcomeB).toMatchObject({ t: "welcome", playerId: welcomeA.playerId, token: welcomeA.token, name });

  a.close();
  b.close();
});

it("refuses retrieval of a password-protected name with the wrong password", async () => {
  const name = uniqueName("pwowner");
  const a = await connect();
  send(a, { t: "hello", name, password: "secret123" });
  await nextMessage(a);

  const b = await connect();
  send(b, { t: "hello", name, password: "wrongpass" });
  const reply = await nextMessage(b);
  expect(reply.t).toBe("nameTaken");

  a.close();
  b.close();
});

it("retrieves a name claimed with a blank password using any password", async () => {
  const name = uniqueName("nopw");
  const a = await connect();
  send(a, { t: "hello", name, password: "" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");

  const b = await connect();
  send(b, { t: "hello", name, password: "literally anything" });
  const offer = await nextMessage(b);
  expect(offer).toMatchObject({ t: "alreadyConnected", playerId: welcomeA.playerId });

  send(b, { t: "hello", name, password: "literally anything", takeover: true });
  const welcomeB = await nextMessage(b);
  expect(welcomeB).toMatchObject({ t: "welcome", playerId: welcomeA.playerId, token: welcomeA.token, name });

  a.close();
  b.close();
});

// The real client always sends whatever reconnect token it already has
// stored, on every hello, regardless of what name was typed into the entry
// box (src/client/net.ts's sendHello). A visitor retrieving a
// password-protected name is very often doing it from a browser that
// already holds a token for some OTHER identity (even an earlier,
// unrelated, auto-generated pseudonym) -- not a token-less browser, which
// is the only case the tests above actually cover. findExistingPlayer must
// not let an unrelated token win outright over a correctly-password-proven
// name; the name+password request should be resolved on its own terms.
it("retrieves a password-protected name by name+password even when the request also carries an unrelated token", async () => {
  const ownerName = uniqueName("pwowner2");
  const owner = await connect();
  send(owner, { t: "hello", name: ownerName, password: "secret123" });
  const ownerWelcome = await nextMessage(owner);
  if (ownerWelcome.t !== "welcome") throw new Error("unreachable");
  owner.close();

  // A second, unrelated identity, fully disconnected before the retrieval
  // attempt -- its token is stale baggage from an earlier visit, not a live
  // connection anything could "take over" from.
  const bystander = await connect();
  send(bystander, { t: "hello", name: uniqueName("bystander") });
  const bystanderWelcome = await nextMessage(bystander);
  if (bystanderWelcome.t !== "welcome") throw new Error("unreachable");
  bystander.close();

  // The bystander's browser now tries to retrieve ownerName with the
  // correct password, while still carrying its own unrelated token --
  // exactly what src/client/net.ts's sendHello always does.
  const retriever = await connect();
  send(retriever, { t: "hello", token: bystanderWelcome.token, name: ownerName, password: "secret123" });
  const result = await nextMessage(retriever);
  expect(result).toMatchObject({ t: "alreadyConnected", playerId: ownerWelcome.playerId, name: ownerName });

  retriever.close();
});

// The same request, but with the WRONG password -- must not fall back to
// resuming the unrelated token's own identity silently. Either a clear
// rejection, or (since the name is legitimately claimed and protected)
// never resolving to the owner's account.
it("does not fall back to an unrelated stored token when the password for the requested name is wrong", async () => {
  const ownerName = uniqueName("pwowner3");
  const owner = await connect();
  send(owner, { t: "hello", name: ownerName, password: "secret123" });
  const ownerWelcome = await nextMessage(owner);
  if (ownerWelcome.t !== "welcome") throw new Error("unreachable");
  owner.close();

  const bystander = await connect();
  send(bystander, { t: "hello", name: uniqueName("bystander2") });
  const bystanderWelcome = await nextMessage(bystander);
  if (bystanderWelcome.t !== "welcome") throw new Error("unreachable");
  bystander.close();

  const retriever = await connect();
  send(retriever, { t: "hello", token: bystanderWelcome.token, name: ownerName, password: "WRONG" });
  const result = await nextMessage(retriever);
  // Must not silently resume the bystander's own unrelated identity instead
  // of acknowledging the retrieval attempt failed.
  expect(result).not.toMatchObject({ t: "welcome", playerId: bystanderWelcome.playerId });
  expect(result.t).toBe("nameTaken");

  retriever.close();
});
