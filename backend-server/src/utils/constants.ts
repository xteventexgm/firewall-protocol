/**
 * Constantes globales del servidor (límites de sala y proporciones de matchmaking).
 *
 * Nota: la proporción de hackers por mesa se escala en `game/balance.ts` (`playersPerBlackHat`).
 * `PLAYERS_PER_BLACK_HAT` aquí es referencia legacy; Matchmaking usa `balance.ts`.
 */
import * as path from 'path';
import { DATA_DIRECTORY } from '../config/env';

/** Mínimo de jugadores conectados para permitir `startGame`. */
export const MIN_PLAYERS = 5;

/** Tope absoluto del servidor; el dashboard elige un máximo por sala ≤ este valor. */
export const MAX_PLAYERS = 15;

/**
 * Referencia documental: proporción caótica en Matchmaking.
 * 1 rol caótico cada N jugadores (ej. 10 jugadores → 2 caóticos como máximo).
 */
export const PLAYERS_PER_CHAOTIC_ROLE = 5;

/**
 * Referencia legacy (Matchmaking usa `playersPerBlackHat` de `balance.ts`).
 * Mantener por compatibilidad con documentación antigua.
 */
export const PLAYERS_PER_BLACK_HAT = 3;

/** Directorio donde se guardan los JSON de partida: `<DATA_DIRECTORY>/games/`. */
export const GAMES_DIR = path.join(DATA_DIRECTORY, 'games');
