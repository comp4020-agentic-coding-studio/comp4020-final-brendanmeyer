// Message shapes exchanged over the game WebSocket. Shared by the server
// (which sends/receives these) and the client (which does the same), so
// both sides stay honest about the wire format.

export interface HelloMessage {
  t: "hello";
  token?: string;
  name?: string;
  // Set after the visitor confirms "take over" in response to
  // AlreadyConnectedMessage: proceed even though this token already has a
  // live connection, and disconnect that one.
  takeover?: boolean;
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

// Sent instead of WelcomeMessage when a resumed token already has a live
// connection elsewhere. The client offers to take over; this socket isn't
// registered as a connection until it resends hello with takeover: true.
export interface AlreadyConnectedMessage {
  t: "alreadyConnected";
  token: string;
  playerId: number;
  name: string;
}

export interface PlayerView {
  id: number;
  name: string;
  x: number;
  y: number;
  // Only these four roles ever appear here -- spectators, queued, and
  // offered visitors have no cursor to render.
  state: "active" | "introducing" | "leaving" | "resuming";
}

export interface StateMessage {
  t: "state";
  status: "waiting" | "running" | "gameover";
  // True when "waiting" means a run is paused (preserved, resumable) rather
  // than never having started -- the two look different on screen.
  pausedWithRun: boolean;
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
  | AlreadyConnectedMessage
  | StateMessage;
