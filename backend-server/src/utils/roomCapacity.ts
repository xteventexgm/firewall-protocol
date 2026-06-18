import { MAX_PLAYERS, MIN_PLAYERS } from './constants';

export function normalizeRoomMaxPlayers(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    throw new Error(`maxPlayers is required (${MIN_PLAYERS}-${MAX_PLAYERS})`);
  }

  const n = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`maxPlayers must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }

  return n;
}
