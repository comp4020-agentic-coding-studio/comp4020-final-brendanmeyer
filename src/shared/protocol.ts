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
  // Requested palette index (planning.md section 2). Honoured if valid and
  // free; otherwise the server assigns a different one.
  color?: number;
}

export interface InputMessage {
  t: "input";
  x: number;
  y: number;
}

// planning.md section 7: a spectator opts into the FIFO queue explicitly
// (not automatically) -- this is also how a declined/expired offer's
// holder re-enters, landing at the back of the queue.
export interface RequestJoinMessage {
  t: "requestJoin";
}

// Accept/decline the current offer this connection holds (StateMessage.you
// role "offered"). Declining has the same effect as letting the 5s claim
// window expire -- the entry is dropped, not requeued.
export interface AcceptOfferMessage {
  t: "acceptOffer";
}

export interface DeclineOfferMessage {
  t: "declineOffer";
}

export type ClientMessage =
  | HelloMessage
  | InputMessage
  | RequestJoinMessage
  | AcceptOfferMessage
  | DeclineOfferMessage;

export interface WelcomeMessage {
  t: "welcome";
  token: string;
  playerId: number;
  name: string;
  color: number;
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
  color: number;
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
  color: number;
  // Only these four roles ever appear here -- spectators, queued, and
  // offered visitors have no cursor to render.
  state: "active" | "introducing" | "leaving" | "resuming";
}

// A connection's own status, personalized per recipient -- a spectator or
// someone waiting in the queue has no entry in `players` at all (no
// cursor), so this is the only way a session learns its own standing.
// remainingMs counts down to the role's own timer completing (the 2s/5s
// countdowns from planning.md sections 4, 5 and 7); queued/offered arrive
// with the join queue (Phase 6).
export type YourView =
  | { role: "active" }
  | { role: "introducing"; remainingMs: number }
  | { role: "leaving"; remainingMs: number }
  | { role: "resuming"; remainingMs: number }
  | { role: "spectator" }
  | { role: "queued"; position: number; size: number }
  | { role: "offered"; remainingMs: number };

export interface StateMessage {
  t: "state";
  status: "waiting" | "running" | "gameover";
  // True when "waiting" means a run is paused (preserved, resumable) rather
  // than never having started -- the two look different on screen.
  pausedWithRun: boolean;
  activeCount: number;
  players: PlayerView[];
  you: YourView;
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
