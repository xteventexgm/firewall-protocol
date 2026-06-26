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
export const MEDIA_URL = (process.env.MEDIA_URL || 'http://localhost:3003').replace(/\/$/, '');
export const INTERNAL_SERVICE_KEY = (process.env.INTERNAL_SERVICE_KEY || '').trim();

/** URL pública del gateway (enlaces en correos: verificación, etc.) */
export const GATEWAY_PUBLIC_URL = (process.env.GATEWAY_PUBLIC_URL || '').trim().replace(/\/$/, '');
export const NGROK_PUBLIC_URL = (process.env.NGROK_URL || process.env.NGROK_PUBLIC_URL || '')
  .trim()
  .replace(/\/$/, '');

export function getPublicAppBaseUrl(): string {
  const candidates = [
    process.env.APP_PUBLIC_URL,
    GATEWAY_PUBLIC_URL,
    NGROK_PUBLIC_URL,
  ]
    .map((raw) => (raw || '').trim().replace(/\/$/, ''))
    .filter(Boolean);

  const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
  const remote = candidates.find((url) => !isLocal(url));
  if (remote) return remote;
  return candidates[0] || 'http://localhost:3000';
}

/** @deprecated usar getPublicAppBaseUrl() */
export const APP_PUBLIC_URL = getPublicAppBaseUrl();

export const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
export const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
export const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';
export const SMTP_USER = (process.env.SMTP_USER || '').trim();
export const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
export const SMTP_FROM = (process.env.SMTP_FROM || SMTP_USER || '').trim();

/** Si true, bloquea login hasta verificar correo */
export const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === 'true' || process.env.REQUIRE_EMAIL_VERIFICATION === '1';

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
