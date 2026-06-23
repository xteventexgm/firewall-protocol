/**
 * Punto de entrada HTTP del servidor.
 * Crea el servidor Node, monta Express y registra namespaces Socket.io (`/game`, `/dashboard`).
 */
import * as http from 'http';
import app from './app';
import initSockets from './sockets';
import { logger } from './utils/logger';
import { PORT } from './config/env';
import { closeDatabase, initializeDatabase } from './config/database';

const server = http.createServer(app);

async function start(): Promise<void> {
	await initializeDatabase();
	initSockets(server);
	server.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));
}

async function shutdown(signal: string): Promise<void> {
	logger.info(`[server] ${signal}, closing`);
	server.close(async () => {
		await closeDatabase();
		process.exit(0);
	});
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

void start().catch((error) => {
	logger.error('[server] startup failed', error?.message ?? error);
	void closeDatabase().finally(() => {
		process.exitCode = 1;
	
	});});

export default server;
