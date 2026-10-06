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

it("rejects a name that's already taken", async () => {
  const a = await connect();
  send(a, { t: "hello", name: "dupname" });
  await nextMessage(a); // welcome

  const b = await connect();
  send(b, { t: "hello", name: "dupname" });
  const reply = await nextMessage(b);
  expect(reply.t).toBe("nameTaken");

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
