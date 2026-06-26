type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const current = (process.env.LOG_LEVEL || 'info') as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[current in LEVELS ? current : 'info'];
}

export const logger = {
  debug: (msg: string, meta?: unknown) => {
    if (shouldLog('debug')) console.log(`[gateway] [DEBUG] ${msg}`, meta ?? '');
  },
  info: (msg: string, meta?: unknown) => {
    if (shouldLog('info')) console.log(`[gateway] [INFO] ${msg}`, meta ?? '');
  },
  warn: (msg: string, meta?: unknown) => {
    if (shouldLog('warn')) console.warn(`[gateway] [WARN] ${msg}`, meta ?? '');
  },
  error: (msg: string, meta?: unknown) => {
    if (shouldLog('error')) console.error(`[gateway] [ERROR] ${msg}`, meta ?? '');
  },
};
