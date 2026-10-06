// Message shapes exchanged over the game WebSocket. Shared by the server
// (which sends/receives these) and the client (which does the same), so
// both sides stay honest about the wire format.

export interface HelloMessage {
  t: "hello";
  token?: string;
  name?: string;
}

export interface InputMessage {
  t: "input";
  x: number;
  y: number;
}

export type ClientMessage = HelloMessage | InputMessage;

export interface WelcomeMessage {
  t: "welcome";
  token: string;
  playerId: number;
  name: string;
}

export interface NameTakenMessage {
  t: "nameTaken";
}

// Still carries the claim's identity: an invalid/empty name isn't a
// rejection, it's a substitution — the visitor is welcomed under the
// generated name instead.
export interface NameInvalidMessage {
  t: "nameInvalid";
  assigned: string;
  token: string;
  playerId: number;
}

export interface PlayerView {
  id: number;
  name: string;
  x: number;
  y: number;
}

export interface StateMessage {
  t: "state";
  status: "waiting" | "running" | "gameover";
  activeCount: number;
  players: PlayerView[];
  snake: { path: [number, number][] };
  food: { x: number; y: number } | null;
  rawScore: number;
  collectiveScore: number;
  multiplier: number;
}

export type ServerMessage =
  | WelcomeMessage
  | NameTakenMessage
  | NameInvalidMessage
  | StateMessage;
