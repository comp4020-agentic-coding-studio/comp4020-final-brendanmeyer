// The public global-stats/leaderboard page (planning.md sections 19, 22).
// Record-run replay playback (section 21) comes with the ghost-trail work;
// this page shows the record list itself regardless, since /api/stats and
// /api/records don't depend on replay data existing.

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

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

const statsEl = required(document.querySelector<HTMLElement>("#stats"), "missing #stats element");
const recordsEl = required(document.querySelector<HTMLElement>("#records"), "missing #records element");

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
      return tr;
    }),
  );
}

void loadStats();
void loadRecords();
