import * as path from 'path';
import { DATA_DIRECTORY } from '../config/env';

export const MIN_PLAYERS = 5;
/** Tope absoluto del servidor; el dashboard elige un máximo por sala ≤ este valor. */
export const MAX_PLAYERS = 15;

/**
 * Proporción de equipo Black Hat al repartir roles.
 * 1 hacker cada N jugadores (ej. 3 → en 9 jugadores hay 3 black_hat).
 * Ajustar aquí para cambiar el balance sin tocar la lógica de Matchmaking.
 */
export const PLAYERS_PER_BLACK_HAT = 3;

/**
 * Proporción de roles caóticos (únicos especiales) en la sala.
 * 1 rol caótico cada N jugadores (ej. 5 → en 10 jugadores hay 2 caóticos como máximo).
 * Ajustar aquí para cambiar el balance sin tocar la lógica de Matchmaking.
 */
export const PLAYERS_PER_CHAOTIC_ROLE = 5;

export const DATA_DIR = DATA_DIRECTORY;
export const GAMES_DIR = path.join(DATA_DIR, 'games');

export default { MIN_PLAYERS, MAX_PLAYERS, DATA_DIR, GAMES_DIR };
