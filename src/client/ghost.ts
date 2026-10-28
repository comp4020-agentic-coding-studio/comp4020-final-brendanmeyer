// Fetches the current record run's replay and plays it on a continuous
// loop (planning.md section 21) -- visual only, local to each viewer
// (toggle state never reaches the server), no interaction with the live
// game besides being drawn alongside it.

export interface ReplaySample {
  elapsedMs: number;
  snakePath: [number, number][];
  players: { x: number; y: number; color: number }[];
}

export interface GhostState {
  enabled: boolean;
  samples: ReplaySample[];
}

// Off by default during play -- a player opts in with the G toggle. While
// waiting for a second player, main.ts forces it on regardless (there's
// nothing else to look at, and it's a good hint for what the game even is),
// overriding whatever G was last set to without changing `enabled` itself.
export function createGhostState(): GhostState {
  return { enabled: false, samples: [] };
}

export async function refreshGhost(state: GhostState): Promise<void> {
  try {
    const recordsRes = await fetch("/api/records");
    const records: { runId: number }[] = await recordsRes.json();
    const top = records[0];
    if (!top) {
      state.samples = [];
      return;
    }
    const replayRes = await fetch(`/api/records/${top.runId}/replay`);
    state.samples = await replayRes.json();
  } catch {
    // No record yet, or a transient fetch failure -- just means no ghost
    // to show until the next refresh.
  }
}

export interface GhostFrame {
  snakePath: [number, number][];
  players: { x: number; y: number; color: number }[];
}

// The frame to draw right now, looping the stored replay on its own local
// clock -- a fixed artifact, not something synced to the live game's tick.
// `forceOn` is the waiting-screen override: true while the game's status is
// "waiting", regardless of what the G toggle last set `state.enabled` to.
export function currentGhostFrame(state: GhostState, nowMs: number, forceOn = false): GhostFrame | null {
  if ((!state.enabled && !forceOn) || state.samples.length === 0) return null;
  const last = state.samples[state.samples.length - 1];
  const totalMs = last.elapsedMs || 1;
  const loopedMs = nowMs % totalMs;

  let sample = state.samples[0];
  for (const candidate of state.samples) {
    if (candidate.elapsedMs > loopedMs) break;
    sample = candidate;
  }
  return { snakePath: sample.snakePath, players: sample.players };
}
