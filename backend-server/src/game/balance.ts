/**
 * Parámetros de balance del Firewall Protocol.
 *
 * Este módulo concentra reglas que escalan según el tamaño de la mesa
 * (número de jugadores al iniciar la partida). El resto del backend importa
 * desde aquí para no duplicar umbrales ni fórmulas.
 *
 * ── Consumidores directos ──────────────────────────────────────────────
 * | Función / constante          | Usado en              | Efecto                    |
 * |------------------------------|-----------------------|---------------------------|
 * | `playersPerBlackHat`         | `Matchmaking.ts`      | Cuántos hackers repartir  |
 * | `pentesterUsesForTable`      | `playerMetadata.ts`   | Usos del Pentester        |
 * | `minerShieldsForTable`       | `playerMetadata.ts`   | Escudos del Minero        |
 * | `ransomwareCooldownNights`   | `ActionValidator.ts`  | Enfriamiento Ransomware   |
 *
 * ── Reglas de balance relacionadas (otros archivos) ───────────────────
 * Documentadas aquí como referencia; no se importan desde este módulo:
 *
 * - **Victoria Black Hat** (`VictoryChecker.ts`): hackers vivos > system vivos (no empate).
 * - **Victoria System**: 0 hackers vivos.
 * - **Caóticos** (`constants.ts`): 1 cada `PLAYERS_PER_CHAOTIC_ROLE` (5) en Matchmaking.
 * - **Gusano** (`RuleEngine.ts` + `infection.ts`):
 *     - Primera kill nocturna falla (`isWormImmune`, se consume).
 *     - Infección madura tras `INFECTION_ROUNDS` (2) noches.
 * - **Minero** (`RuleEngine.ts`): escudos solo bloquean kills directos; infección madura los ignora.
 * - **DDoS** (`RuleEngine.ts`): voto hacker ×2; silencia al objetivo del consenso si sobrevive.
 * - **Honeypot** (`RuleEngine.ts`): arrastre ignora protección Antivirus.
 * - **Zero-Day** (`ActionValidator.ts`): una asunción de rol por partida.
 * - **SOC scan** (`RuleEngine.ts`): safe / suspicious (caótico) / malicious (hacker); Rootkit → safe.
 * - **Límite de días** (`VictoryChecker.ts`): empate prolongado → gana quien tenga ventaja numérica
 *   (System en empate hacker/system).
 * - **Zero-Day assume** (`VictoryChecker.ts`): hereda metadata del rol asumido (`initRoleMetadata`).
 *
 * ── Umbrales de mesa ──────────────────────────────────────────────────
 * - **Pequeña**: 5–7 jugadores (`SMALL_TABLE_MAX`) — más recursos defensivos, menos hackers.
 * - **Mediana**: 8–9 jugadores — transición (pentester/minero como mesa grande).
 * - **Grande**: 10+ jugadores (`LARGE_TABLE_MIN`) — Ransomware con cooldown más corto.
 */

/** Mesa pequeña (5–7 jugadores): reglas más favorables al Sistema (más usos defensivos, menos presión hacker). */
export const SMALL_TABLE_MAX = 7;

/** Mesa grande (10+ jugadores): partidas más largas; Ransomware puede reutilizarse antes. */
export const LARGE_TABLE_MIN = 10;

/**
 * Indica si la partida se considera mesa pequeña.
 * @param playerCount Jugadores en la sala al llamar a `startGame`.
 */
export function isSmallTable(playerCount: number): boolean {
  return playerCount <= SMALL_TABLE_MAX;
}

/**
 * Usos totales de `pentester_kill` durante toda la partida.
 * - Mesas pequeñas (≤7): 1 — evita que un blue elimine demasiada mesa en pocas noches.
 * - Mesas 8+: 2 — red team interno con más margen ofensivo autorizado.
 *
 * Se fija en `initRoleMetadata` al repartir roles (`playerMetadata.ts`).
 */
export function pentesterUsesForTable(playerCount: number): number {
  return isSmallTable(playerCount) ? 1 : 2;
}

/**
 * Cargas de escudo del Minero de Cripto (bloquean kills **directos** en `RuleEngine.tryKill`).
 * - Mesas pequeñas: 2 capas.
 * - Mesas 8+: 3 capas.
 *
 * No aplican a muertes por infección madura (`bypassMinerShield`).
 * Se fija en `initRoleMetadata` al repartir roles.
 */
export function minerShieldsForTable(playerCount: number): number {
  return isSmallTable(playerCount) ? 2 : 3;
}

/**
 * Noches que debe esperar Ransomware antes de volver a usar `ransomware`.
 * Se decrementa al entrar en fase NOCHE (`VictoryChecker.tickRansomwareCooldowns`).
 *
 * - Mesas 10+: 1 noche de enfriamiento (partidas largas, rol más ágil).
 * - Mesas ≤9: 2 noches (Ransomware es muy disruptivo con pocos jugadores).
 *
 * Asignado en `markActionSubmitted` (`ActionValidator.ts`).
 */
export function ransomwareCooldownNights(playerCount: number): number {
  return playerCount >= LARGE_TABLE_MIN ? 1 : 2;
}

/**
 * Proporción de reparto Black Hat en Matchmaking: 1 hacker cada N jugadores.
 * - Mesas ≤8: N = 4 (menos hackers en lobby pequeño; ej. 5 jugadores → 1 hacker).
 * - Mesas 9+: N = 3 (presión red team estándar; ej. 9 jugadores → 3 hackers).
 *
 * Usado en `computeTeamBalance` (`Matchmaking.ts`). Mínimo 1 hacker siempre.
 */
export function playersPerBlackHat(playerCount: number): number {
  return playerCount <= 8 ? 4 : 3;
}

/**
 * Tabla de referencia rápida por tamaño de mesa (solo documentación; no se exporta al runtime).
 *
 * | Jugadores | Hackers (aprox.) | Pentester | Minero | Ransomware CD |
 * |-----------|------------------|-----------|--------|---------------|
 * | 5         | 1 (1/4)          | 1 uso     | 2      | 2 noches      |
 * | 7         | 1 (1/4)          | 1 uso     | 2      | 2 noches      |
 * | 8         | 2 (1/4)          | 2 usos    | 3      | 2 noches      |
 * | 10        | 3 (1/3)          | 2 usos    | 3      | 1 noche       |
 * | 15        | 5 (1/3)          | 2 usos    | 3      | 1 noche       |
 *
 * Caóticos: floor(jugadores / 5), resto System. Ver `PLAYERS_PER_CHAOTIC_ROLE` en `constants.ts`.
 */

/** Días máximos (fases DIA) antes de desempate forzado en mesas pequeñas. */
export const STALEMATE_DAYS_SMALL = 8;

/** Días máximos en mesas 8+ (más jugadores → más tiempo para converger). */
export const STALEMATE_DAYS_LARGE = 10;

/**
 * Tras este número de días, `VictoryChecker` fuerza victoria de bando si no hay fin solitario.
 * En empate hacker/system vivos, gana System (defensa sostenida).
 */
export function stalemateDayLimit(playerCount: number): number {
  return isSmallTable(playerCount) ? STALEMATE_DAYS_SMALL : STALEMATE_DAYS_LARGE;
}
