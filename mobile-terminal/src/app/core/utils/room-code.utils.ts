/** Extrae código de sala del texto del QR del dashboard (ej. FIRE-XXXX). */
export function parseRoomCodeFromScan(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/FIRE-[A-Z0-9]{4}/);
  if (match) return match[0];
  if (/^[A-Z0-9-]{4,12}$/.test(upper)) return upper;
  return null;
}

/** Proporción hackers según balance.ts del backend. */
export function playersPerBlackHatForTable(playerCount: number): number {
  return playerCount <= 8 ? 4 : 3;
}
