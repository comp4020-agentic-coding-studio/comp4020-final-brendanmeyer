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

// A connection that's been live a while (anything past its initial hello)
// can have a "state" broadcast land between a request and its actual
// reply -- the game loop ticks independently of whatever's being tested.
// Skips any number of those to find the next message of a specific type.
function nextMessageOfType<T extends ServerMessage["t"]>(
  socket: WebSocket,
  type: T,
): Promise<Extract<ServerMessage, { t: T }>> {
  return new Promise((resolve, reject) => {
    function onMessage(data: WebSocket.RawData): void {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      if (msg.t === type) {
        socket.off("message", onMessage);
        resolve(msg as Extract<ServerMessage, { t: T }>);
      }
    }
    socket.on("message", onMessage);
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

// The same request, but with the WRONG password. The one invariant that
// actually matters for a protected account: a wrong password must never
// grant someone else's protected identity, however the attempt is
// otherwise handled (keeping the bystander's own identity, a conflict
// reply -- either is fine, this only pins down what must never happen).
it("never resolves to someone else's protected identity when the password is wrong, even holding an unrelated token", async () => {
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
  expect(result).not.toMatchObject({ playerId: ownerWelcome.playerId });
  if ("token" in result) expect(result.token).not.toBe(ownerWelcome.token);

  retriever.close();
});

// Setting a password after the fact: a name claimed with none should still
// be protectable later, without needing to have planned ahead at claim
// time. Operates on the sender's own connected identity only -- no target
// player id in the message at all, consistent with decisions/0002 (no
// cross-player actions exist in this protocol).
it("lets a connected, password-less identity set a password, which then protects it", async () => {
  const name = uniqueName("addpw");
  const a = await connect();
  send(a, { t: "hello", name, password: "" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");

  send(a, { t: "setPassword", password: "newsecret" });
  const setReply = await nextMessageOfType(a, "passwordSet");
  expect(setReply).toMatchObject({ ok: true });
  a.close();

  // A fresh retrieval attempt with the wrong password must now fail --
  // before setPassword, any password at all would have retrieved it.
  const wrong = await connect();
  send(wrong, { t: "hello", name, password: "guess" });
  const wrongReply = await nextMessage(wrong);
  expect(wrongReply.t).toBe("nameTaken");
  wrong.close();

  // The right (newly-set) password still retrieves it.
  const right = await connect();
  send(right, { t: "hello", name, password: "newsecret" });
  const rightReply = await nextMessage(right);
  expect(rightReply).toMatchObject({ t: "alreadyConnected", playerId: welcomeA.playerId });
  right.close();
});

// Not a change/reset flow -- an identity that already has a password keeps
// it, and setPassword on it is a no-op refusal, not a silent overwrite.
it("refuses to set a password on an identity that already has one", async () => {
  const name = uniqueName("haspw");
  const a = await connect();
  send(a, { t: "hello", name, password: "original" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");

  send(a, { t: "setPassword", password: "newone" });
  const setReply = await nextMessageOfType(a, "passwordSet");
  expect(setReply).toMatchObject({ ok: false, reason: "alreadyHasPassword" });
  a.close();

  // The original password still works -- it wasn't overwritten.
  const retriever = await connect();
  send(retriever, { t: "hello", name, password: "original" });
  const reply = await nextMessage(retriever);
  expect(reply).toMatchObject({ t: "alreadyConnected", playerId: welcomeA.playerId });
  retriever.close();
});

it("refuses a blank password, since that's the no-password state a name already has", async () => {
  const name = uniqueName("blankpw");
  const a = await connect();
  send(a, { t: "hello", name, password: "" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");

  send(a, { t: "setPassword", password: "" });
  const setReply = await nextMessageOfType(a, "passwordSet");
  expect(setReply).toMatchObject({ ok: false, reason: "blank" });
  a.close();
});

// The client can't know in advance whether an identity has a password
// unless the server tells it -- otherwise the "set a password" button has
// no way to know when to hide itself. welcome (and the generated-pseudonym
// equivalent, nameInvalid) carry hasPassword so the client doesn't have to
// guess or attempt-and-fail.
it("reports hasPassword:false on a fresh claim, then hasPassword:true after setPassword succeeds", async () => {
  const name = uniqueName("hasflag");
  const a = await connect();
  send(a, { t: "hello", name, password: "" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");
  expect(welcomeA.hasPassword).toBe(false);

  send(a, { t: "setPassword", password: "flagtest" });
  await nextMessageOfType(a, "passwordSet");
  a.close();

  // A later resume (same token) should now report hasPassword:true.
  const resumed = await connect();
  send(resumed, { t: "hello", token: welcomeA.token });
  const resumedWelcome = await nextMessage(resumed);
  if (resumedWelcome.t !== "welcome") throw new Error("unreachable");
  expect(resumedWelcome.hasPassword).toBe(true);
  resumed.close();
});

it("reports hasPassword:true immediately when claiming with a password", async () => {
  const name = uniqueName("hasflag2");
  const a = await connect();
  send(a, { t: "hello", name, password: "setatclaim" });
  const welcomeA = await nextMessage(a);
  if (welcomeA.t !== "welcome") throw new Error("unreachable");
  expect(welcomeA.hasPassword).toBe(true);
  a.close();
});
