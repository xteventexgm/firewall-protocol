/**
 * Variables de entorno del servicio game-realtime.
 */
import 'dotenv/config';
import * as dns from 'dns';
import * as path from 'path';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3001);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || path.join(process.cwd(), 'data');

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
export const IDENTITY_URL = (process.env.IDENTITY_URL || 'http://localhost:3002').replace(/\/$/, '');

export const NIGHT_DURATION_MS = Number(process.env.NIGHT_DURATION_MS || 60_000);
export const DAY_DURATION_MS = Number(process.env.DAY_DURATION_MS || 60_000);
export const AUTO_ADVANCE = process.env.AUTO_ADVANCE === 'true' || process.env.AUTO_ADVANCE === '1';
export const DEV_BOTS_ENABLED =
  process.env.DEV_BOTS !== 'false' && process.env.DEV_BOTS !== '0';

export function isDockerRuntime(): boolean {
  return process.env.DOCKER === '1' || process.env.DOCKER === 'true';
}

export function assertRequiredRuntimeEnv(): void {
  if (!isDockerRuntime()) return;
  const missing: string[] = [];
  if (!MONGO_URI) missing.push('MONGO_URI');
  if (missing.length) {
    throw new Error(
      `Variables obligatorias en Docker:\n${missing.map((n) => `  - ${n}`).join('\n')}`,
    );
  }
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
