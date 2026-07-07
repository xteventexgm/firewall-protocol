/**
 * Utilidades para calcular el balance estimado de equipos en el Lobby.
 * Replica la lógica base de balance.ts del backend para el preview del frontend.
 */

export interface TeamComposition {
  system: number;
  blackHat: number;
  chaotic: number;
  systemPercentage: number;
  blackHatPercentage: number;
  chaoticPercentage: number;
}

export function estimateTeamComposition(playerCount: number): TeamComposition {
  // Asegurar mínimo 0 para cálculos, aunque mínimo real sea 5.
  const count = Math.max(0, playerCount);
  
  if (count === 0) {
    return {
      system: 0,
      blackHat: 0,
      chaotic: 0,
      systemPercentage: 0,
      blackHatPercentage: 0,
      chaoticPercentage: 0
    };
  }

  // 1 Caótico por cada 5 jugadores
  const chaotic = Math.floor(count / 5);

  // 1 Hacker por cada N jugadores (4 si <= 8, 3 si >= 9)
  const playersPerBlackHat = count <= 8 ? 4 : 3;
  // Mínimo 1 hacker en partidas reales (si el count >= 1)
  const blackHat = count > 0 ? Math.max(1, Math.floor(count / playersPerBlackHat)) : 0;

  // System es el resto
  const system = Math.max(0, count - chaotic - blackHat);

  const total = system + blackHat + chaotic;

  return {
    system,
    blackHat,
    chaotic,
    systemPercentage: total > 0 ? (system / total) * 100 : 0,
    blackHatPercentage: total > 0 ? (blackHat / total) * 100 : 0,
    chaoticPercentage: total > 0 ? (chaotic / total) * 100 : 0
  };
}
