import { expect, inject, it } from "vitest";
import WebSocket from "ws";
import type { ClientMessage, ServerMessage } from "../src/shared/protocol.ts";

// planning.md's name rules: alphanumeric, <=22 chars, case-insensitively
// unique, with a server-generated fallback for anything invalid or empty.
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

// A fixed literal name permanently claims that row in the players table, so
// a second run against the same long-lived local dev server collides with
// the first run's own leftover claim, not just within a single run -- every
// test below checks the resulting name or role, not just pass/fail, so that
// collision would change the outcome rather than being tolerated by
// coincidence. A unique-per-run name avoids it.
function uniqueName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

// A password-less name is retrievable by name alone (spec/password.test.ts),
// so a second claimant with no token isn't rejected outright anymore -- it's
// offered the same confirm-before-kick takeover as any other duplicate
// identity (decisions/0001's Case 1), since the server genuinely can't tell
// "someone else wants this name" from "its owner, on a new device" when no
// password protects it.
it("offers a takeover rather than rejecting outright when a live, password-less name is reclaimed", async () => {
  const name = uniqueName("dup");
  const a = await connect();
  send(a, { t: "hello", name });
  await nextMessage(a); // welcome

  const b = await connect();
  send(b, { t: "hello", name });
  const reply = await nextMessage(b);
  expect(reply.t).toBe("alreadyConnected");

  a.close();
  b.close();
});

it("assigns a generated pseudonym for an empty name", async () => {
  const a = await connect();
  send(a, { t: "hello", name: "" });
  const reply = await nextMessage(a);
  expect(reply).toMatchObject({ t: "nameInvalid" });
  if (reply.t === "nameInvalid") {
    expect(reply.assigned.length).toBeGreaterThan(0);
  }
  a.close();
});

// A generated pseudonym isn't a permanent identity -- resuming the same
// token with a different, available name should actually adopt it, not
// silently keep the old one (the chosen-name screen is pointless otherwise).
it("replaces a generated pseudonym with a chosen name on resume", async () => {
  const chosen = uniqueName("chosen");
  const a = await connect();
  send(a, { t: "hello", name: "" });
  const first = await nextMessage(a);
  if (first.t !== "nameInvalid") throw new Error("unreachable");
  const { token } = first;

  const b = await connect();
  send(b, { t: "hello", token, name: chosen, takeover: true });
  const second = await nextMessage(b);
  expect(second).toMatchObject({ t: "welcome", token, name: chosen });

  a.close();
  b.close();
});

it("keeps the existing name if the requested replacement is already taken", async () => {
  const taken = uniqueName("taken");
  const other = await connect();
  send(other, { t: "hello", name: taken });
  await nextMessage(other);

  const a = await connect();
  send(a, { t: "hello", name: "" });
  const first = await nextMessage(a);
  if (first.t !== "nameInvalid") throw new Error("unreachable");
  const { token, assigned } = first;

  const b = await connect();
  send(b, { t: "hello", token, name: taken, takeover: true });
  const second = await nextMessage(b);
  expect(second).toMatchObject({ t: "welcome", token, name: assigned });

  other.close();
  a.close();
  b.close();
});
