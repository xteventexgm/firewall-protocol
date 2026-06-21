/**
 * Adaptador de persistencia de partidas.
 *
 * Abstrae `dbSyncService` (JSON en disco hoy) para migrar a MongoDB sin cambiar
 * `Room` ni `RoomManager`. Métodos `delete` y `list` preparados para admin futuro.
 */
import dbSync, { GameArchiveCategory } from '../services/dbSyncService';
import { logger } from '../utils/logger';

/** Contrato de persistencia; implementación actual: JSON vía dbSyncService. */
export interface DBAdapter {
	save(roomId: string, state: any): boolean;
	load(roomId: string): any | null;
	delete(roomId: string): boolean;
	archive(roomId: string, category: GameArchiveCategory, extra?: Record<string, unknown>): boolean;
	list(): string[];
	getStatus(roomId: string, playerId?: string): ReturnType<typeof dbSync.getActiveRoomStatus>;
}

const adapter: DBAdapter = {
	save: (roomId: string, state: any) => {
		const players = state?.players?.length ?? 0;
		const phase = state?.phase ?? '?';
		const ok = dbSync.saveGameState(roomId, state);
		logger.info('[db] save', ok ? 'OK' : 'FAIL', { roomId, phase, players });
		return ok;
	},
	load: (roomId: string) => {
		const data = dbSync.loadGameState(roomId);
		if (data) {
			logger.info('[db] load OK', {
				roomId,
				phase: data.phase,
				players: data.players?.length ?? 0,
			});
		} else {
			logger.info('[db] load miss (sin archivo JSON)', { roomId });
		}
		return data;
	},
	delete: (roomId: string) => {
		const ok = dbSync.deleteGameState(roomId);
		logger.info('[db] delete', ok ? 'OK' : 'FAIL', { roomId });
		return ok;
	},
	archive: (roomId: string, category: GameArchiveCategory, extra?: Record<string, unknown>) => {
		const ok = dbSync.archiveGameState(roomId, category, extra);
		logger.info('[db] archive', ok ? 'OK' : 'FAIL', { roomId, category });
		return ok;
	},
	list: () => dbSync.listSavedGames(),
	getStatus: (roomId: string, playerId?: string) => dbSync.getActiveRoomStatus(roomId, playerId),
};

export default adapter;
