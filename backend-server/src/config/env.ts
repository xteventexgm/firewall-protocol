/**
 * Variables de entorno y opciones por defecto de sala.
 */
import 'dotenv/config';
import * as path from 'path';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3000);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || path.join(process.cwd(), 'data');

/** URI de MongoDB. Si está definida, el servidor usa `MongoDBAdapter` (obligatorio conectar). */
export const MONGO_URI = (process.env.MONGO_URI || '').trim();

/** Nombre de la base de datos MongoDB (default: `firewall_protocol`). */
export const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'firewall_protocol';

/** Secreto para firmar JWT de acceso. Requerido para habilitar `/api/auth/*`. */
export const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

/** Secreto para hashear refresh tokens en `auth_sessions`. */
export const SESSION_SECRET = (process.env.SESSION_SECRET || JWT_SECRET || 'dev-session-secret').trim();

/** Duración del access token JWT (segundos). */
export const JWT_ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 900);

/** Duración del refresh token (días). */
export const JWT_REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);

export const NIGHT_DURATION_MS = Number(process.env.NIGHT_DURATION_MS || 60_000);
export const DAY_DURATION_MS = Number(process.env.DAY_DURATION_MS || 60_000);
export const AUTO_ADVANCE = process.env.AUTO_ADVANCE === 'true' || process.env.AUTO_ADVANCE === '1';

export const DEV_BOTS_ENABLED =
	process.env.DEV_BOTS !== 'false' && process.env.DEV_BOTS !== '0';

export function devBotsEnabled(): boolean {
	return DEV_BOTS_ENABLED;
}

export function defaultRoomOptions() {
	return {
		nightDurationMs: NIGHT_DURATION_MS,
		dayDurationMs: DAY_DURATION_MS,
		autoAdvance: AUTO_ADVANCE,
	};
}
