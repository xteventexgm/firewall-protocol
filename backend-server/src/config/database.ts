/**
 * Adaptador de persistencia de partidas.
 *
 * Selecciona automáticamente MongoDB (`MONGO_URI` vía `mongoConnection`) o JSON en disco.
 * Los adaptadores MongoDB deben usar `getDb()` / `getMongoClient()` después de `connectMongo()`.
 * Ver DATABASE.md y `services/MongoDBAdapter.ts`.
 */
import { createJsonAdapter } from '../services/JsonAdapter';
import { createMongoDBAdapter } from '../services/MongoDBAdapter';
import { isMongoEnabled } from '../services/mongoConnection';
import { logger } from '../utils/logger';
import type { DBAdapter } from './database.types';

export type { ActiveRoomStatus, DBAdapter } from './database.types';

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

export default adapter;
