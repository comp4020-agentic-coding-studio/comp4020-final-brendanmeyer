// The public global-stats/leaderboard page (planning.md sections 19, 21,
// 22): global stats, the record-run list, and clicking a run replays it.

import { drawGhost } from "./render.js";

interface GlobalStats {
  totalRuns: number;
  totalFoodCollected: number;
  totalUniquePlayers: number;
  totalPlayTimeMs: number;
  largestActiveGroup: number;
  recordCollectiveScore: number;
}

interface RecordRunRow {
  runId: number;
  collectiveScore: number;
  rawScore: number;
  endedAt: number;
  peakPlayers: number;
}

interface ReplaySample {
  elapsedMs: number;
  snakePath: [number, number][];
  players: { x: number; y: number; color: number }[];
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

const statsEl = required(document.querySelector<HTMLElement>("#stats"), "missing #stats element");
const recordsEl = required(document.querySelector<HTMLElement>("#records"), "missing #records element");
const replayCanvas = required(document.querySelector<HTMLCanvasElement>("#replay"), "missing #replay canvas");
const replayCtx = required(replayCanvas.getContext("2d"), "2d canvas context unavailable");

let playing: { samples: ReplaySample[]; startedAt: number } | null = null;

function playReplay(samples: ReplaySample[]): void {
  replayCanvas.hidden = false;
  replayCanvas.style.display = "block";
  replayCanvas.width = replayCanvas.clientWidth;
  replayCanvas.height = replayCanvas.clientWidth;
  playing = { samples, startedAt: performance.now() };
}

function replayFrame(): void {
  if (playing && playing.samples.length > 0) {
    const last = playing.samples[playing.samples.length - 1];
    const totalMs = last.elapsedMs || 1;
    const loopedMs = (performance.now() - playing.startedAt) % totalMs;
    let sample = playing.samples[0];
    for (const candidate of playing.samples) {
      if (candidate.elapsedMs > loopedMs) break;
      sample = candidate;
    }
    replayCtx.clearRect(0, 0, replayCanvas.width, replayCanvas.height);
    replayCtx.fillStyle = "#0b1021";
    replayCtx.fillRect(0, 0, replayCanvas.width, replayCanvas.height);
    drawGhost(replayCtx, replayCanvas.width, replayCanvas.height, sample, 1);
  }
  requestAnimationFrame(replayFrame);
}
requestAnimationFrame(replayFrame);

async function loadAndPlayReplay(runId: number): Promise<void> {
  const res = await fetch(`/api/records/${runId}/replay`);
  const samples: ReplaySample[] = await res.json();
  playReplay(samples);
}

function formatMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

async function loadStats(): Promise<void> {
  const res = await fetch("/api/stats");
  const stats: GlobalStats = await res.json();
  const rows: [string, string][] = [
    ["Total runs", String(stats.totalRuns)],
    ["Total food collected", String(stats.totalFoodCollected)],
    ["Total unique players", String(stats.totalUniquePlayers)],
    ["Total play time", formatMs(stats.totalPlayTimeMs)],
    ["Largest active group", String(stats.largestActiveGroup)],
    ["All-time record collective score", String(stats.recordCollectiveScore)],
  ];
  statsEl.replaceChildren(
    ...rows.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}

async function loadRecords(): Promise<void> {
  const res = await fetch("/api/records");
  const records: RecordRunRow[] = await res.json();
  recordsEl.replaceChildren(
    ...records.map((run) => {
      const tr = document.createElement("tr");
      const cells = [
        String(run.collectiveScore),
        String(run.rawScore),
        String(run.peakPlayers),
        new Date(run.endedAt).toLocaleString(),
      ];
      for (const text of cells) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      tr.addEventListener("click", () => void loadAndPlayReplay(run.runId));
      return tr;
    }),
  );
}

void loadStats();
void loadRecords();
