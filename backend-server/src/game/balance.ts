/** Mesa pequeña (5–7 jugadores): reglas de balance más suaves para el Sistema. */
export const SMALL_TABLE_MAX = 7;

/** Mesa grande (10+): Ransomware y similares con enfriamiento reducido. */
export const LARGE_TABLE_MIN = 10;

export function isSmallTable(playerCount: number): boolean {
  return playerCount <= SMALL_TABLE_MAX;
}

/** Pentester: 1 uso en mesas pequeñas, 2 en 8+. */
export function pentesterUsesForTable(playerCount: number): number {
  return isSmallTable(playerCount) ? 1 : 2;
}

/** Minero: 2 escudos en mesas pequeñas, 3 en 8+. */
export function minerShieldsForTable(playerCount: number): number {
  return isSmallTable(playerCount) ? 2 : 3;
}

/** Noches de cooldown tras usar Ransomware. */
export function ransomwareCooldownNights(playerCount: number): number {
  return playerCount >= LARGE_TABLE_MIN ? 1 : 2;
}

/** 1 hacker cada N jugadores (4 en mesas ≤8, 3 en 9+). */
export function playersPerBlackHat(playerCount: number): number {
  return playerCount <= 8 ? 4 : 3;
}
