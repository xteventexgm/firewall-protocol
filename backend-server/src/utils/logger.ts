const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = typeof LEVELS[number];

function timestamp() {
	return new Date().toISOString();
}

function log(level: Level, ...args: any[]) {
	if (LEVELS.indexOf(level) < 0) return;
	const out = `[${timestamp()}] [${level.toUpperCase()}]`;
	if (level === 'error') console.error(out, ...args);
	else if (level === 'warn') console.warn(out, ...args);
	else console.log(out, ...args);
}

export const logger = {
	debug: (...args: any[]) => log('debug', ...args),
	info: (...args: any[]) => log('info', ...args),
	warn: (...args: any[]) => log('warn', ...args),
	error: (...args: any[]) => log('error', ...args),
};

export default logger;
