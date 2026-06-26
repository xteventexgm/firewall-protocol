/**
 * Implementación JSON en disco de `DBAdapter` (fallback sin MongoDB).
 */
import dbSync, { GameArchiveCategory } from './dbSyncService';
import { readSessionLogFile } from './GameSessionLogService';
import { logger } from '../utils/logger';
import type { DBAdapter } from '../config/database';

export function createJsonAdapter(): DBAdapter {
	return {
		save(roomId: string, state: any) {
			const players = state?.players?.length ?? 0;
			const phase = state?.phase ?? '?';
			const ok = dbSync.saveGameState(roomId, state);
			logger.info('[db:json] save', ok ? 'OK' : 'FAIL', { roomId, phase, players });
			return ok;
		},
		load(roomId: string) {
			const data = dbSync.loadGameState(roomId);
			if (data) {
				logger.info('[db:json] load OK', {
					roomId,
					phase: data.phase,
					players: data.players?.length ?? 0,
				});
			}
			return data;
		},
		loadOrArchive(roomId: string) {
			return dbSync.loadGameStateOrArchive(roomId);
		},
		async loadOrArchiveAsync(roomId: string) {
			return dbSync.loadGameStateOrArchive(roomId);
		},
		readSessionLog(roomId: string) {
			return readSessionLogFile(roomId);
		},
		async readSessionLogAsync(roomId: string) {
			return readSessionLogFile(roomId);
		},
		delete(roomId: string) {
			const ok = dbSync.deleteGameState(roomId);
			logger.info('[db:json] delete', ok ? 'OK' : 'FAIL', { roomId });
			return ok;
		},
		archive(roomId: string, category: GameArchiveCategory, extra?: Record<string, unknown>) {
			const ok = dbSync.archiveGameState(roomId, category, extra);
			logger.info('[db:json] archive', ok ? 'OK' : 'FAIL', { roomId, category });
			return ok;
		},
		list() {
			return dbSync.listSavedGames();
		},
		getStatus(roomId: string, playerId?: string) {
			return dbSync.getActiveRoomStatus(roomId, playerId);
		},
	};
}
