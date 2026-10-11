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

export function createGhostState(): GhostState {
  return { enabled: true, samples: [] };
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
export function currentGhostFrame(state: GhostState, nowMs: number): GhostFrame | null {
  if (!state.enabled || state.samples.length === 0) return null;
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
