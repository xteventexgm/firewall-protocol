/**
 * Variables de entorno y opciones por defecto de sala.
 */
import 'dotenv/config';
import * as dns from 'dns';
import * as path from 'path';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3000);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || path.join(process.cwd(), 'data');

/** Mongo local cuando no hay `MONGO_URI` en desarrollo. */
const LOCAL_MONGO_URI = 'mongodb://localhost:27017/firewall_protocol';

/** Cluster MongoDB Atlas (credenciales vía `MONGO_URI` o `MONGO_PASSWORD`). */
function buildAtlasMongoUri(): string {
	const user = 'firewall-protocol_db_user';
	const password = encodeURIComponent((process.env.MONGO_PASSWORD || 'admin').trim());
	return `mongodb+srv://${user}:${password}@firewall-protocol.vzqx091.mongodb.net/?appName=Firewall-protocol`;
}

/**
 * URI de MongoDB. Si está definida en `.env`, se usa tal cual.
 * Sin `MONGO_URI`: Atlas en producción, Mongo local en desarrollo.
 * El servidor usa `MongoDBAdapter` cuando esta cadena no está vacía.
 */
export const MONGO_URI = (() => {
	const explicit = (process.env.MONGO_URI || '').trim();
	if (explicit) return explicit;
	return NODE_ENV === 'production' ? buildAtlasMongoUri() : LOCAL_MONGO_URI;
})();

/** Resolvers DNS para `mongodb+srv://` (evita querySrv ECONNREFUSED en routers Windows). */
if (MONGO_URI.startsWith('mongodb+srv://')) {
	const servers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (servers.length > 0) dns.setServers(servers);
}

/** Nombre de la base de datos MongoDB (default: `firewall_protocol`). */
export const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'firewall_protocol';

/** Secreto para firmar JWT de acceso. Requerido para habilitar `/api/auth/*`. */
export const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

/** Secreto para hashear refresh tokens en `auth_sessions`. */
export const SESSION_SECRET = (process.env.SESSION_SECRET || JWT_SECRET || 'dev-session-secret').trim();

/** Duración del access token JWT (segundos). Default 24 h — partidas largas sin cortar sesión API. */
export const JWT_ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 86_400);

/** Duración del refresh token (días). Se renueva al rotar en `/api/auth/refresh`. */
export const JWT_REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 90);

export const NIGHT_DURATION_MS = Number(process.env.NIGHT_DURATION_MS || 60_000);
export const DAY_DURATION_MS = Number(process.env.DAY_DURATION_MS || 60_000);
export const AUTO_ADVANCE = process.env.AUTO_ADVANCE === 'true' || process.env.AUTO_ADVANCE === '1';

export const DEV_BOTS_ENABLED =
	process.env.DEV_BOTS !== 'false' && process.env.DEV_BOTS !== '0';

/** `disk` o almacenamiento S3-compatible (`r2`, `s3`; `minio` queda como alias legacy). */
const avatarStorageRaw = (process.env.AVATAR_STORAGE || 'disk').trim().toLowerCase();
export const AVATAR_STORAGE: 'disk' | 's3' = ['s3', 'r2', 'minio'].includes(avatarStorageRaw) ? 's3' : 'disk';
export const AVATAR_STORAGE_LABEL = AVATAR_STORAGE === 'disk' ? 'disk' : avatarStorageRaw;

const DEFAULT_R2_ENDPOINT =
	'https://ffe5e4f2990d77373e5b02dd67b16749.r2.cloudflarestorage.com';

function envFirst(...keys: string[]): string {
	for (const key of keys) {
		const value = (process.env[key] || '').trim();
		if (value) return value;
	}
	return '';
}

function resolveS3Endpoint(): string {
	const explicit = envFirst('S3_ENDPOINT', 'R2_ENDPOINT');
	if (explicit) {
		return explicit.startsWith('http://') || explicit.startsWith('https://')
			? explicit
			: `https://${explicit}`;
	}

	const minioHost = (process.env.MINIO_ENDPOINT || '').trim();
	if (minioHost) {
		const useSsl = process.env.MINIO_USE_SSL === 'true' || process.env.MINIO_USE_SSL === '1';
		const port = String(process.env.MINIO_PORT || (useSsl ? 443 : 9000));
		const proto = useSsl ? 'https' : 'http';
		if ((useSsl && port === '443') || (!useSsl && port === '80')) {
			return `${proto}://${minioHost}`;
		}
		return `${proto}://${minioHost}:${port}`;
	}

	if (avatarStorageRaw === 'r2') return DEFAULT_R2_ENDPOINT;
	return '';
}

/** Endpoint S3 API (Cloudflare R2, MinIO local, etc.). */
export const S3_ENDPOINT = resolveS3Endpoint();
export const S3_ACCESS_KEY = envFirst('S3_ACCESS_KEY', 'R2_ACCESS_KEY_ID', 'MINIO_ACCESS_KEY');
export const S3_SECRET_KEY = envFirst('S3_SECRET_KEY', 'R2_SECRET_ACCESS_KEY', 'MINIO_SECRET_KEY');
export const S3_BUCKET = envFirst('S3_BUCKET', 'R2_BUCKET', 'MINIO_BUCKET') || 'avatars';
export const S3_REGION = envFirst('S3_REGION', 'R2_REGION') || 'auto';

export function isDockerRuntime(): boolean {
	return process.env.DOCKER === '1' || process.env.DOCKER === 'true';
}

/**
 * En Docker exige variables explícitas para Atlas y R2 (sin fallbacks locales).
 * Falla al arranque si faltan credenciales obligatorias.
 */
export function assertRequiredRuntimeEnv(): void {
	if (!isDockerRuntime()) return;

	const missing: string[] = [];

	if (!(process.env.MONGO_URI || '').trim()) missing.push('MONGO_URI');
	if (!(process.env.JWT_SECRET || '').trim()) missing.push('JWT_SECRET');

	if (AVATAR_STORAGE === 's3') {
		if (!S3_ENDPOINT) missing.push('S3_ENDPOINT (o R2_ENDPOINT)');
		if (!S3_ACCESS_KEY) missing.push('S3_ACCESS_KEY (o R2_ACCESS_KEY_ID)');
		if (!S3_SECRET_KEY) missing.push('S3_SECRET_KEY (o R2_SECRET_ACCESS_KEY)');
		if (!S3_BUCKET) missing.push('S3_BUCKET (o R2_BUCKET)');
	}

	if (missing.length === 0) return;

	throw new Error(
		`Variables de entorno obligatorias no definidas:\n` +
			missing.map((name) => `  - ${name}`).join('\n') +
			`\n\nCompleta backend-server/.env antes de ejecutar docker compose up.`,
	);
}

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
