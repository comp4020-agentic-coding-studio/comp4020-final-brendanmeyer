// planning.md section 19: leaderboard order is collective_score
// descending; an exact tie keeps the run that reached it first on top --
// a later tied score never displaces the original record-holder.

export function isNewRecord(candidateScore: number, previousBest: number | null): boolean {
  return previousBest === null || candidateScore > previousBest;
}

export interface RecordRow {
  collectiveScore: number;
  endedAt: number;
}

export function sortRecords<T extends RecordRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.collectiveScore - a.collectiveScore || a.endedAt - b.endedAt);
}
