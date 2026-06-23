/**
 * Conexión singleton a MongoDB.
 */
import { Db, MongoClient } from 'mongodb';
import { MONGO_DB_NAME, MONGO_URI } from '../config/env';
import { logger } from '../utils/logger';

let client: MongoClient | null = null;
let db: Db | null = null;
let lastError: string | null = null;
let connected = false;

export function isMongoEnabled(): boolean {
	return Boolean(MONGO_URI);
}

export function isMongoConnected(): boolean {
	return connected && db !== null;
}

export function getMongoLastError(): string | null {
	return lastError;
}

export async function connectMongo(): Promise<Db> {
	if (db) return db;
	if (!isMongoEnabled()) {
		throw new Error('MONGO_URI no está configurado en .env');
	}

	try {
		client = new MongoClient(MONGO_URI, {
			serverSelectionTimeoutMS: 8000,
			connectTimeoutMS: 8000,
		});
		await client.connect();
		await client.db(MONGO_DB_NAME).command({ ping: 1 });
		db = client.db(MONGO_DB_NAME);
		connected = true;
		lastError = null;
		logger.info('[mongo] connected', { database: MONGO_DB_NAME, uri: maskUri(MONGO_URI) });
		return db;
	} catch (err: unknown) {
		connected = false;
		db = null;
		lastError = err instanceof Error ? err.message : String(err);
		throw new Error(
			`No se pudo conectar a MongoDB (${MONGO_DB_NAME}).\n` +
				`URI: ${maskUri(MONGO_URI)}\n` +
				`Detalle: ${lastError}\n` +
				`Verifica que MongoDB esté en ejecución y ejecuta: npm run db:setup`,
		);
	}
}

export function getDb(): Db {
	if (!db) {
		throw new Error('MongoDB no conectado — el servidor debería haber fallado al arrancar');
	}
	return db;
}

export async function closeMongo(): Promise<void> {
	if (client) await client.close();
	client = null;
	db = null;
	connected = false;
}

function maskUri(uri: string): string {
	return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}
