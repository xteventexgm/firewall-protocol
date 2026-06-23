/**
 * Adaptador de persistencia de partidas.
 *
 * Selecciona automáticamente MongoDB (`MONGO_URI`) o JSON en disco (`dbSyncService`).
 * Ver DATABASE.md y `services/MongoDBAdapter.ts`.
 */
import { GameArchiveCategory } from '../services/dbSyncService';
import { createJsonAdapter } from '../services/JsonAdapter';
import { createMongoDBAdapter } from '../services/MongoDBAdapter';
import { isMongoEnabled } from '../services/mongoConnection';
import { logger } from '../utils/logger';
import { MONGO_DB_NAME, MONGO_URI } from './env';
import type { DBAdapter } from './database.types';

export type ActiveRoomStatus = {
	exists: boolean;
	phase: string | null;
	playerCount: number;
	connectedCount: number;
	canJoin: boolean;
	canReconnect: boolean;
};

/** Contrato de persistencia compartido por JSON y MongoDB. */
export interface DBAdapter {
	save(roomId: string, state: any): boolean;
	load(roomId: string): any | null;
	loadOrArchive(roomId: string): any | null;
	loadOrArchiveAsync(roomId: string): Promise<any | null>;
	readSessionLog(roomId: string): string | null;
	readSessionLogAsync(roomId: string): Promise<string | null>;
	delete(roomId: string): boolean;
	archive(roomId: string, category: GameArchiveCategory, extra?: Record<string, unknown>): boolean;
	list(): string[];
	getStatus(roomId: string, playerId?: string): ActiveRoomStatus;
	warmCache?(): Promise<void>;
}

const isTestRun = Boolean(process.env.npm_lifecycle_event?.includes('test'));
const useMongo = isMongoEnabled() && !isTestRun && process.env.FP_USE_JSON !== '1';

const adapter: DBAdapter = useMongo ? createMongoDBAdapter() : createJsonAdapter();

if (useMongo) {
	logger.info('[db] using MongoDB adapter');
} else if (isMongoEnabled() && isTestRun) {
	logger.info('[db] using JSON adapter (modo test)');
} else {
	logger.info('[db] using JSON file adapter');
}

export async function warmDatabaseCache(): Promise<void> {
	if (adapter.warmCache) {
		await adapter.warmCache();
	}
}

export function getPersistenceMode(): 'mongodb' | 'json' {
	return useMongo ? 'mongodb' : 'json';
}

const mongoAdapter = MONGO_URI ? new MongoDBAdapter(MONGO_URI, MONGO_DB_NAME) : null;
const adapter: DBAdapter = mongoAdapter ?? jsonAdapter;

export async function initializeDatabase(): Promise<void> {
  if (mongoAdapter) {
    await mongoAdapter.initialize();
  } else {
    logger.info('[db] using JSON fallback (MONGO_URI is not configured)');
  }
}

export async function closeDatabase(): Promise<void> {
  await mongoAdapter?.close();
}

export default adapter;
