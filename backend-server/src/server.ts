/**
 * Punto de entrada HTTP del servidor.
 */
import 'dotenv/config';
import * as http from 'http';
import app from './app';
import initSockets from './sockets';
import { warmDatabaseCache } from './config/database';
import { MONGO_URI } from './config/env';
import { connectMongo, isMongoEnabled } from './services/mongoConnection';
import { logger } from './utils/logger';
import { PORT } from './config/env';
import { closeDatabase, initializeDatabase } from './config/database';

function printMongoFailure(error: unknown): void {
	const msg = error instanceof Error ? error.message : String(error);
	const banner = [
		'',
		'════════════════════════════════════════════════════════════',
		'  ERROR: NO SE PUDO CONECTAR A MONGODB',
		'════════════════════════════════════════════════════════════',
		'',
		msg,
		'',
		'Opciones:',
		'  1. Inicia MongoDB (local o docker-compose up)',
		'  2. Ejecuta: npm run db:setup',
		'  3. O quita MONGO_URI del .env para usar JSON local',
		'',
		'════════════════════════════════════════════════════════════',
		'',
	].join('\n');
	console.error(banner);
}

function printJsonModeNotice(): void {
	console.warn(
		'\n[db] MODO JSON LOCAL — MONGO_URI no configurado.\n' +
			'     Las partidas se guardan en data/games/. Auth de usuarios deshabilitado.\n' +
			'     Para MongoDB: copia .env.example → .env y define MONGO_URI.\n',
	);
}

async function bootstrap(): Promise<void> {
	if (isMongoEnabled()) {
		try {
			await connectMongo();
			await warmDatabaseCache();
		} catch (err) {
			printMongoFailure(err);
			process.exit(1);
		}
	} else {
		printJsonModeNotice();
	}

	const server = http.createServer(app);
	initSockets(server as any);

	server.listen(PORT, () => {
		logger.info(`Server listening on port ${PORT}`, {
			persistence: isMongoEnabled() ? 'mongodb' : 'json',
			mongoUri: isMongoEnabled() ? MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@') : undefined,
		});
	});
}

void bootstrap().catch((err: unknown) => {
	printMongoFailure(err);
	process.exit(1);
});
