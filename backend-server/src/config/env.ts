/**
 * Variables de entorno y opciones por defecto de sala.
 *
 * Leídas desde `.env` o valores fallback. Usadas en arranque (`server.ts`),
 * persistencia (`DATA_DIRECTORY`) y timers opcionales de `Room` (`defaultRoomOptions`).
 */
import * as path from 'path';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3000);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || path.join(process.cwd(), 'data');

/** Duración de la fase NOCHE antes de auto-avance (ms). */
export const NIGHT_DURATION_MS = Number(process.env.NIGHT_DURATION_MS || 60_000);

/** Duración de la fase DIA antes de auto-avance (ms). */
export const DAY_DURATION_MS = Number(process.env.DAY_DURATION_MS || 60_000);

/** Si true, las fases NOCHE y DIA avanzan automáticamente tras el timeout configurado. */
export const AUTO_ADVANCE = process.env.AUTO_ADVANCE === 'true' || process.env.AUTO_ADVANCE === '1';

/** Opciones de timer y auto-avance aplicadas al construir cada `Room`. */
export function defaultRoomOptions() {
  return {
    nightDurationMs: NIGHT_DURATION_MS,
    dayDurationMs: DAY_DURATION_MS,
    autoAdvance: AUTO_ADVANCE,
  };
}
