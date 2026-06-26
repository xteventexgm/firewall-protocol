/**
 * Variables de entorno del servicio de identidad.
 */
import 'dotenv/config';
import * as dns from 'dns';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3001);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LOCAL_MONGO_URI = 'mongodb://localhost:27017/firewall_protocol';

export const MONGO_URI = (() => {
  const explicit = (process.env.MONGO_URI || '').trim();
  if (explicit) return explicit;
  return NODE_ENV === 'production' ? '' : LOCAL_MONGO_URI;
})();

if (MONGO_URI.startsWith('mongodb+srv://')) {
  const servers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length > 0) dns.setServers(servers);
}

export const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'firewall_protocol';
export const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
export const SESSION_SECRET = (process.env.SESSION_SECRET || JWT_SECRET || 'dev-session-secret').trim();
export const JWT_ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 86_400);
export const JWT_REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 90);
export const MEDIA_PUBLIC_URL = (process.env.MEDIA_PUBLIC_URL || '').trim().replace(/\/$/, '');
export const INTERNAL_SERVICE_KEY = (process.env.INTERNAL_SERVICE_KEY || '').trim();

export function isDockerRuntime(): boolean {
  return process.env.DOCKER === '1' || process.env.DOCKER === 'true';
}

export function assertRequiredRuntimeEnv(): void {
  if (!isDockerRuntime()) return;
  const missing: string[] = [];
  if (!MONGO_URI) missing.push('MONGO_URI');
  if (!JWT_SECRET) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(
      `Variables obligatorias en Docker:\n${missing.map((n) => `  - ${n}`).join('\n')}`,
    );
  }
}
