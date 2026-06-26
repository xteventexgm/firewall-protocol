/**
 * Logger ligero a consola con filtro por `LOG_LEVEL` (`config/env.ts`).
 * Usado en sockets, persistencia, salas y handlers.
 */
import { LOG_LEVEL } from '../config/env';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: Level = LEVELS.includes(LOG_LEVEL as Level) ? (LOG_LEVEL as Level) : 'info';

function timestamp() {
  return new Date().toISOString();
}

function shouldLog(level: Level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function log(level: Level, ...args: any[]) {
  if (!shouldLog(level)) return;
  const out = `[${timestamp()}] [${level.toUpperCase()}]`;
  if (level === 'error') console.error(out, ...args);
  else if (level === 'warn') console.warn(out, ...args);
  else console.log(out, ...args);
}

/** API de logging: `logger.info`, `logger.warn`, `logger.error`, `logger.debug`. */
export const logger = {
  debug: (...args: any[]) => log('debug', ...args),
  info: (...args: any[]) => log('info', ...args),
  warn: (...args: any[]) => log('warn', ...args),
  error: (...args: any[]) => log('error', ...args),
};
