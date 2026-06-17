import dbSync from '../services/dbSyncService';
import { logger } from '../utils/logger';

export interface DBAdapter {
	save(roomId: string, state: any): boolean;
	load(roomId: string): any | null;
	delete(roomId: string): boolean;
	list(): string[];
}

const adapter: DBAdapter = {
	save: (roomId: string, state: any) => {
		logger.debug('DB save', roomId);
		return dbSync.saveGameState(roomId, state);
	},
	load: (roomId: string) => {
		logger.debug('DB load', roomId);
		return dbSync.loadGameState(roomId);
	},
	delete: (roomId: string) => {
		logger.debug('DB delete', roomId);
		return dbSync.deleteGameState(roomId);
	},
	list: () => dbSync.listSavedGames(),
};

export default adapter;
