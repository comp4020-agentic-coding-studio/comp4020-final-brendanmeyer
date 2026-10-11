// Player colour reservation (planning.md section 2): 16 predefined
// colours, never shared by two active players at once. Release happens
// only once a disconnected player's connection is fully removed (sweep()'s
// "removed" step), not when the leaving flash starts -- the flash still
// shows their reserved colour.

export const COLOR_COUNT = 16;

export interface ColorState {
  reservations: Map<number, number>; // paletteIndex -> playerId
}

export function createColorState(): ColorState {
  return { reservations: new Map() };
}

export function availableIndices(state: ColorState): number[] {
  const result: number[] = [];
  for (let i = 0; i < COLOR_COUNT; i++) {
    if (!state.reservations.has(i)) result.push(i);
  }
  return result;
}

function isValidIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < COLOR_COUNT;
}

// Reserves `preferred` if it's a valid, free index; otherwise the
// lowest-numbered free colour. Returns null only if all 16 are somehow
// already reserved (can't happen at the 12-active-player cap, since at
// least 4 always stay free).
export function reserve(state: ColorState, playerId: number, preferred?: number | null): number | null {
  if (preferred !== undefined && preferred !== null && isValidIndex(preferred) && !state.reservations.has(preferred)) {
    state.reservations.set(preferred, playerId);
    return preferred;
  }
  const free = availableIndices(state)[0];
  if (free === undefined) return null;
  state.reservations.set(free, playerId);
  return free;
}

export function release(state: ColorState, playerId: number): void {
  for (const [index, id] of state.reservations) {
    if (id === playerId) {
      state.reservations.delete(index);
      return;
    }
  }
}
