/** Selects MongoDB when MONGO_URI is configured, otherwise keeps the JSON fallback. */
import dbSync from '../services/dbSyncService';
import { readSessionLogFile } from '../services/GameSessionLogService';
import { MongoDBAdapter } from '../services/MongoDBAdapter';
import { logger } from '../utils/logger';
import { MONGO_DB_NAME, MONGO_URI } from './env';
import type { DBAdapter } from './database.types';

export type { ActiveRoomStatus, DBAdapter } from './database.types';

const jsonAdapter: DBAdapter = {
  save: (roomId, state) => {
    const ok = dbSync.saveGameState(roomId, state);
    logger.info('[db] JSON save', ok ? 'OK' : 'FAIL', { roomId, phase: state?.phase, players: state?.players?.length ?? 0 });
    return ok;
  },
  load: dbSync.loadGameState,
  loadOrArchive: dbSync.loadGameStateOrArchive,
  readSessionLog: readSessionLogFile,
  delete: dbSync.deleteGameState,
  archive: dbSync.archiveGameState,
  list: dbSync.listSavedGames,
  getStatus: dbSync.getActiveRoomStatus,
};

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
