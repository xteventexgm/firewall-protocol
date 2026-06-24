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
import { ensureMinioBucket, isMinioAvatarStorage } from './services/minioClient';
import { getAvatarStorageMode } from './services/AvatarService';
import { logger } from './utils/logger';
import { PORT } from './config/env';

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

function printMinioFailure(error: unknown): void {
	const msg = error instanceof Error ? error.message : String(error);
	const banner = [
		'',
		'════════════════════════════════════════════════════════════',
		'  ERROR: NO SE PUDO CONECTAR A MINIO (avatares)',
		'════════════════════════════════════════════════════════════',
		'',
		msg,
		'',
		'Opciones:',
		'  1. Inicia MinIO: docker compose up minio -d',
		'  2. O usa AVATAR_STORAGE=disk en .env',
		'',
		'════════════════════════════════════════════════════════════',
		'',
	].join('\n');
	console.error(banner);
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

	if (isMinioAvatarStorage()) {
		try {
			await ensureMinioBucket();
		} catch (err) {
			printMinioFailure(err);
			process.exit(1);
		}
	}

	const server = http.createServer(app);
	initSockets(server as any);

	server.listen(PORT, () => {
		logger.info(`Server listening on port ${PORT}`, {
			persistence: isMongoEnabled() ? 'mongodb' : 'json',
			avatarStorage: getAvatarStorageMode(),
			mongoUri: isMongoEnabled() ? MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@') : undefined,
		});
	});
}

void bootstrap().catch((err: unknown) => {
	printMongoFailure(err);
	process.exit(1);
});
