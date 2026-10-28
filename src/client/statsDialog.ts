// The public global-stats/leaderboard view (planning.md sections 19, 21,
// 22), as an in-page dialog over index.html rather than a separate
// /stats.html -- the same reasoning as dialog.ts/passwordDialog.ts: it's
// laid over whatever the visitor was already doing, not a page of its own.

import { drawGhost } from "./render.js";

export interface GlobalStats {
  totalRuns: number;
  totalFoodCollected: number;
  totalUniquePlayers: number;
  totalPlayTimeMs: number;
  largestActiveGroup: number;
  recordCollectiveScore: number;
}

export interface RecordRunRow {
  runId: number;
  collectiveScore: number;
  rawScore: number;
  endedAt: number;
  peakPlayers: number;
}

export interface ReplaySample {
  elapsedMs: number;
  snakePath: [number, number][];
  players: { x: number; y: number; color: number }[];
}

export interface StatsDialogElements {
  overlay: HTMLElement;
  closeButton: HTMLButtonElement;
  statsEl: HTMLElement;
  recordsEl: HTMLElement;
  replayCanvas: HTMLCanvasElement;
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

// Closing the dialog goes back to the game it was laid over, unless that
// game was already gone before the dialog opened -- there's nothing left
// to lay it back over, so the entry screen (a fresh claim or retrieval) is
// the only place left to send the visitor.
export function shouldReturnToEntryOnClose(wasConnected: boolean): boolean {
  return !wasConnected;
}

async function loadStats(statsEl: HTMLElement): Promise<void> {
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

// Opens the dialog, loads/refreshes its contents, and resolves once the
// visitor closes it -- true if the caller should send them to the entry
// screen (see shouldReturnToEntryOnClose), false to just hide the dialog
// and let them carry on where they were.
function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

export function showStatsDialog(elements: StatsDialogElements, isConnected: () => boolean): Promise<boolean> {
  const { overlay, closeButton, statsEl, recordsEl, replayCanvas } = elements;
  const ctx = required(replayCanvas.getContext("2d"), "2d canvas context unavailable");

  let playing: { samples: ReplaySample[]; startedAt: number } | null = null;
  let stopped = false;

  function playReplay(samples: ReplaySample[]): void {
    replayCanvas.hidden = false;
    replayCanvas.width = replayCanvas.clientWidth;
    replayCanvas.height = replayCanvas.clientWidth;
    playing = { samples, startedAt: performance.now() };
  }

  function replayFrame(): void {
    if (stopped) return;
    if (playing && playing.samples.length > 0) {
      const last = playing.samples[playing.samples.length - 1];
      const totalMs = last.elapsedMs || 1;
      const loopedMs = (performance.now() - playing.startedAt) % totalMs;
      let sample = playing.samples[0];
      for (const candidate of playing.samples) {
        if (candidate.elapsedMs > loopedMs) break;
        sample = candidate;
      }
      ctx.clearRect(0, 0, replayCanvas.width, replayCanvas.height);
      ctx.fillStyle = "#0b1021";
      ctx.fillRect(0, 0, replayCanvas.width, replayCanvas.height);
      drawGhost(ctx, replayCanvas.width, replayCanvas.height, sample, 1);
    }
    requestAnimationFrame(replayFrame);
  }

  async function loadAndPlayReplay(runId: number): Promise<void> {
    const res = await fetch(`/api/records/${runId}/replay`);
    const samples: ReplaySample[] = await res.json();
    playReplay(samples);
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

  // Read before the async loads below so an immediate close can't race a
  // disconnect that happens while the dialog is still open.
  const wasConnected = isConnected();

  overlay.hidden = false;
  closeButton.focus();
  void loadStats(statsEl);
  void loadRecords();
  requestAnimationFrame(replayFrame);

  return new Promise((resolve) => {
    function onClose(): void {
      stopped = true;
      overlay.hidden = true;
      closeButton.removeEventListener("click", onClose);
      overlay.removeEventListener("keydown", onKeydown);
      resolve(shouldReturnToEntryOnClose(wasConnected));
    }
    function onKeydown(e: Event): void {
      if ((e as KeyboardEvent).key === "Escape") onClose();
    }
    closeButton.addEventListener("click", onClose);
    overlay.addEventListener("keydown", onKeydown);
  });
}
