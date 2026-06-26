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

function shouldLog(level: Level) {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function log(level: Level, ...args: unknown[]) {
  if (!shouldLog(level)) return;
  const out = `[${new Date().toISOString()}] [identity] [${level.toUpperCase()}]`;
  if (level === 'error') console.error(out, ...args);
  else if (level === 'warn') console.warn(out, ...args);
  else console.log(out, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};
