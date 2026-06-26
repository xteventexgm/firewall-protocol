import 'dotenv/config';

export const PORT = Number(process.env.PORT || 3000);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const IDENTITY_URL = (process.env.IDENTITY_URL || 'http://localhost:3002').replace(/\/$/, '');

/** URL interna del servicio game-realtime (sin barra final). */
export const GAME_REALTIME_URL = (process.env.GAME_REALTIME_URL || 'http://localhost:3001').replace(
  /\/$/,
  '',
);

/** URL interna del servicio media (sin barra final). */
export const MEDIA_URL = (process.env.MEDIA_URL || 'http://localhost:3003').replace(/\/$/, '');
