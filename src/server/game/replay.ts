// planning.md section 21: a record run's ghost-trail replay is sampled at
// a server-defined rate (10/second suggested) rather than every tick
// (~15Hz) -- "reasonable replay fidelity without unnecessarily large
// storage." Only ever persisted for a run that turns out to be a record
// (db/repo.ts's recordRun decides that); every other run's buffer is just
// discarded.

export interface ReplaySample {
  elapsedMs: number;
  snakePath: [number, number][];
  players: { id: number; name: string; x: number; y: number; color: number }[];
  rawScore: number;
  collectiveScore: number;
  activeCount: number;
}

const SAMPLE_INTERVAL_MS = 100;

export interface ReplayBuffer {
  samples: ReplaySample[];
  lastSampledAt: number;
}

export function createReplayBuffer(): ReplayBuffer {
  return { samples: [], lastSampledAt: -Infinity };
}

export function maybeSample(
  buffer: ReplayBuffer,
  now: number,
  runStartedAt: number,
  sample: Omit<ReplaySample, "elapsedMs">,
): void {
  if (now - buffer.lastSampledAt < SAMPLE_INTERVAL_MS) return;
  buffer.lastSampledAt = now;
  buffer.samples.push({ ...sample, elapsedMs: now - runStartedAt });
}

// Returns and clears the buffer -- called once per finished run, whether
// or not it turns out to be a record (the caller decides what to do with
// the result).
export function takeSamples(buffer: ReplayBuffer): ReplaySample[] {
  const samples = buffer.samples;
  buffer.samples = [];
  buffer.lastSampledAt = -Infinity;
  return samples;
}
